#!/usr/bin/env bash
# Latency diagnostics for the live Railway deployment.
# Run from your laptop. Requires: curl, jq (optional, for pretty numbers).
#
# Usage:
#   RAILWAY_URL=https://your-app.up.railway.app \
#   OPENAI_API_KEY=sk-or-v1-... \
#   EXA_API_KEY=... \
#   ./scripts/latency-probe.sh

set -u

: "${RAILWAY_URL:?Set RAILWAY_URL to your Railway backend (no trailing slash)}"
: "${OPENAI_API_KEY:?Set OPENAI_API_KEY (OpenRouter key)}"
: "${EXA_API_KEY:?Set EXA_API_KEY (Exa key)}"

PROBE_ID="probe-$(date +%s)"
OUT_DIR="${TMPDIR:-/tmp}/latency-probe-$$"
mkdir -p "$OUT_DIR"
trap 'rm -rf "$OUT_DIR"' EXIT

hr() { printf '\n%s\n' "------------------------------------------------------------"; }

# Measure: total time, time-to-first-byte.
# - $1 = label
# - rest = curl args
measure() {
	local label="$1"; shift
	local ttfb_ms total_ms
	# curl -w writes timings to stderr; we use %{time_starttransfer} for TTFB
	# and %{time_total} for the full request. Note: -o /dev/null discards body.
	local fmt
	fmt='TTFB=%{time_starttransfer}s TOTAL=%{time_total}s HTTP=%{http_code} SIZE=%{size_download}\n'
	local out
	out=$(curl -sS -o "$OUT_DIR/$label.body" -w "$fmt" "$@" 2>&1) || {
		printf '  [%s] FAILED: %s\n' "$label" "$out"
		return 1
	}
	printf '  [%s] %s\n' "$label" "$out"
}

hr
echo "BASELINE 0 — Railway health (no LLM, no Exa)"
hr
measure "railway-health" \
	--max-time 30 \
	"$RAILWAY_URL/agents"

hr
echo "TEST A — Supervisor chat turn (the slow path)"
echo "  Reasoning effort forced to 'low' to isolate orchestration cost."
hr
measure "railway-stream" \
	--max-time 180 \
	-N \
	-X POST \
	-H "Content-Type: application/json" \
	-d "{\"input\":\"hi\",\"options\":{\"memory\":{\"conversationId\":\"$PROBE_ID\",\"userId\":\"cso-user\"},\"reasoning\":{\"effort\":\"low\",\"exclude\":true}}}" \
	"$RAILWAY_URL/agents/cso-intel-assistant/stream"

# Show first/last 200 bytes of the streamed body so we can see how
# much text came back and whether Exa was hit.
if [ -s "$OUT_DIR/railway-stream.body" ]; then
	echo "  --- stream head ---"
	head -c 400 "$OUT_DIR/railway-stream.body"
	echo
	echo "  --- stream tail ---"
	tail -c 400 "$OUT_DIR/railway-stream.body"
	echo
else
	echo "  (no body captured)"
fi

hr
echo "TEST B — Direct OpenRouter call (same model, no orchestrator)"
hr
measure "openrouter-direct" \
	--max-time 60 \
	-X POST \
	-H "Authorization: Bearer $OPENAI_API_KEY" \
	-H "Content-Type: application/json" \
	-d '{"model":"openai/gpt-4o-mini","messages":[{"role":"user","content":"hi"}],"stream":false,"max_tokens":200}' \
	"https://openrouter.ai/api/v1/chat/completions"

hr
echo "TEST C — Direct Exa call (isolates Exa network cost)"
hr
measure "exa-direct" \
	--max-time 30 \
	-X POST \
	-H "x-api-key: $EXA_API_KEY" \
	-H "Content-Type: application/json" \
	-d '{"query":"Abu Dhabi financial centre market 2026","numResults":3}' \
	"https://api.exa.ai/search"

hr
echo "SUMMARY"
hr
cat <<'EOF'
Compare the three TOTAL times:
  railway-health       — pure HTTP/baseline. Should be < 0.5s.
  railway-stream       — the user-visible path. Likely 5-30s.
  openrouter-direct    — single LLM round-trip. Likely 1-3s.
  exa-direct           — one Exa call. Likely 1-3s.

Diagnosis heuristics:
  railway-stream ≈ openrouter-direct
    → bottleneck is the model itself. Try a faster model (gpt-4o-mini
      is already fast — likely a routing/upstream issue on OpenRouter).
  railway-stream >> openrouter-direct, but a single test ran 1 sub-agent
    → orchestration loops / sub-agent prompts. Lower AGENT_MAX_STEPS.
  railway-stream >> openrouter-direct + exa-direct
    → multiple sub-agent calls + multiple Exa calls. The supervisor is
      delegating more than it should; check sub-agent tool prompts.
  exa-direct > 3s consistently
    → Exa is slow or your key is on a throttled tier. Cache aggressively
      (the in-process cache in src/services/exa-search.ts:25 only helps
      within one process lifetime — restart on Railway wipes it).
EOF
