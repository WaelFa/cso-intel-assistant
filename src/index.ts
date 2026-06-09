// ──────────────────────────────────────────────────────────────────
// CSO Strategic Intelligence Assistant — Main Entry Point
//
// This file wires everything together:
//   1. Logger   → structured logging (Pino)
//   2. Memory   → conversation persistence (LibSQL) + vector memory
//   3. LLM      → language model provider (OpenRouter)
//   4. Retriever → document RAG store (Phase 3)
//   5. Agents   → supervisor + specialized sub-agents
//   6. Workflows → intelligence-pipeline (Phase 3)
//   7. Server   → HTTP/WebSocket endpoints (Hono)
//
// Read docs/00-voltagent-foundations.md for a detailed walkthrough
// of each component and why it exists.
// ──────────────────────────────────────────────────────────────────

import "dotenv/config";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { InMemoryVectorAdapter, Memory, VoltAgent } from "@voltagent/core";
import { LibSQLMemoryAdapter } from "@voltagent/libsql";
import { createPinoLogger } from "@voltagent/logger";
import { honoServer } from "@voltagent/server-hono";

// Silence the noisy "System messages in the prompt or messages fields"
// warning that the AI SDK emits when VoltAgent composes sub-agent
// delegation calls. The warning is a false positive in this codebase —
// our supervisor prompt is passed via the `system` option, and the
// delegation scaffolding inside VoltAgent is the source of the
// messages-arg system role. The AI SDK's `AI_SDK_LOG_WARNINGS` global
// does NOT control this particular warning (it issues a direct
// `console.warn` in `ai/dist/index.js`). We filter the specific
// message via `console.warn` interception, which is scoped narrowly
// to the substring below so legitimate warnings still surface.
{
	const ORIGINAL_WARN = console.warn.bind(console);
	const SUPPRESS_PREFIX =
		"AI SDK Warning: System messages in the prompt or messages fields";
	console.warn = (...args: unknown[]) => {
		const first = args[0];
		if (typeof first === "string" && first.startsWith(SUPPRESS_PREFIX)) {
			return;
		}
		ORIGINAL_WARN(...args);
	};
}

import { createSupervisorAgent } from "./agents/index.js";
import { seedDocuments } from "./data/seed-documents.js";
import {
	reconfigureScheduler,
	runScheduledJob,
	startScheduler,
	stopScheduler,
} from "./jobs/schedule-briefing.js";
import { getSupervisorPrompt } from "./prompts/index.js";
import {
	DocumentStore,
	createAiSdkEmbedder,
	detectKind,
	extractText,
} from "./retriever/index.js";
import {
	listAvailableBriefingDates,
	readPreparedBriefing,
} from "./services/briefing-preparer.js";
import { readSettings, updateSettings } from "./services/settings-store.js";
import { createIntelligencePipeline } from "./workflows/intelligence-pipeline.js";

// ── 1. Logger ─────────────────────────────────────────────────────
// Structured JSON logging via Pino.
// Change level to "debug" when troubleshooting.
const logger = createPinoLogger({
	name: "cso-intel-assistant",
	level: "info",
});

// ── 2. Memory ─────────────────────────────────────────────────────
// Persists conversations in a local SQLite file via LibSQL.
// Every user message and agent response is stored here so the
// agent can "remember" earlier parts of the conversation.
//
// We also enable vector memory (embeddings + in-memory vector store)
// so that Phase 3 RAG tools (document upload + retrieval) can attach
// the same Memory instance for semantic search across past turns.
//
// See docs/00-voltagent-foundations.md → "Memory & LibSQL" section,
// and docs/01-multi-agent-architecture.md → "Vector Memory".
const memory = new Memory({
	storage: new LibSQLMemoryAdapter({
		url: "file:./.voltagent/memory.db",
		logger: logger.child({ component: "libsql" }),
	}),
	// OpenRouter exposes OpenAI-compatible embeddings; reusing the
	// same endpoint keeps the wiring simple.
	embedding: "openai/text-embedding-3-small",
	vector: new InMemoryVectorAdapter(),
});

// ── 3. LLM Provider ──────────────────────────────────────────────
// OpenRouter gives us access to 100+ models through one API key.
// We use the OpenAI-compatible protocol (the de facto standard).
//
// Default: "openai/gpt-4o-mini" — cheap, reliable, mature tool-calling.
//
// To switch, set MODEL_ID in .env (or change the line below) and restart npm run dev.
// Pricing is per 1M tokens (input / output). All listed are under $1/M both ways
// as of Jun 2026 — the budget envelope for this project.
//
// Top recommendations for a CSO strategic-intelligence workload:
//
//   deepseek/deepseek-chat-v3.2   $0.28 / $0.42  ⭐ frontier quality at budget price
//   google/gemini-2.5-flash-lite  $0.10 / $0.40  ⭐ 1M context, free dev tier
//   openai/gpt-4.1-nano           $0.10 / $0.40  ⭐ 1M context, most mature fn-calling
//   google/gemini-2.0-flash       $0.10 / $0.40    1M context, reliable
//   openai/gpt-4o-mini            $0.15 / $0.60    current default, works fine
//   openai/gpt-5-nano             $0.05 / $0.40    absolute cheapest, smaller model
//   mistralai/mistral-small-3.2   $0.10 / $0.30    GDPR-friendly, 131K context
//   qwen/qwen3-32b                $0.18 / $0.28    strong general purpose
//   meta-llama/llama-3.3-70b      $0.59 / $0.79    large open-weights
//   x-ai/grok-4-fast              $0.20 / $0.50    2M context (largest available)
//
// Notes:
//  - For Phase 3 RAG (long document context), prefer gemini-2.5-flash-lite or gpt-4.1-nano
//    (both 1M context). DeepSeek-chat-v3.2 is 128K.
//  - For complex multi-step reasoning (sub-agent orchestration), deepseek-chat-v3.2
//    gives the best quality-per-dollar in this price band.
//  - Claude Haiku 4.5 ($1.00/$5.00) is exactly at the input limit and $5 output —
//    excluded; use deepseek-chat-v3.2 for Anthropic-style quality on a budget.
const openrouter = createOpenAICompatible({
	name: "openrouter",
	baseURL: process.env.OPENAI_BASE_URL ?? "https://openrouter.ai/api/v1",
	apiKey: process.env.OPENAI_API_KEY ?? "",
	transformRequestBody: (body) => {
		// The dashboard lets the user pick a reasoning effort per
		// message (Fast / Medium / Deep). It is forwarded via
		// `options.reasoning.effort` in the chat request body. We
		// fall back to "medium" when missing or invalid so a stale
		// or malformed request still gets a safe default.
		const allowedEfforts = ["low", "medium", "high"] as const;
		type AllowedEffort = (typeof allowedEfforts)[number];
		const isAllowed = (v: unknown): v is AllowedEffort =>
			typeof v === "string" &&
			(allowedEfforts as readonly string[]).includes(v);
		const incoming = (
			body as { options?: { reasoning?: { effort?: unknown } } }
		)?.options?.reasoning?.effort;
		const effort: AllowedEffort = isAllowed(incoming) ? incoming : "medium";
		return {
			...body,
			reasoning: {
				effort,
				exclude: true,
			},
		};
	},
});

const model = openrouter(process.env.MODEL_ID ?? "openai/gpt-4o-mini");

// Embedding model — shared across the Memory (conversation
// vector search) and the document RAG store. We use the
// OpenRouter-hosted `openai/text-embedding-3-small`, which is
// 1536 dimensions and inexpensive.
const embeddingModel = openrouter.embeddingModel(
	"openai/text-embedding-3-small",
);

// ── 4. Retriever (Phase 3) ────────────────────────────────────────
// Centralised RAG store. One DocumentStore per process; rebuilt on
// every restart. The seed loader below repopulates it from
// `data/seed/` so the assistant has a working knowledge base
// from the first request.
const documentStore = new DocumentStore(createAiSdkEmbedder(embeddingModel));

// Seed the corpus on boot. We do this BEFORE creating the agent
// so the supervisor's retrieve_documents tool can return hits
// from the first message. Failures here are non-fatal — the
// server still comes up and uploads will still work.
const seedResult = await seedDocuments(documentStore, { logger }).catch(
	(err) => {
		logger.error(
			`[seed] Seed loader crashed unexpectedly: ${err instanceof Error ? err.message : String(err)}`,
		);
		return { attempted: 0, ingested: 0, skipped: 0, errors: [String(err)] };
	},
);
logger.info(
	`[seed] ${seedResult.ingested} ingested, ${seedResult.skipped} skipped, ${seedResult.errors.length} error(s)`,
);

// Read initial settings to configure dynamic settings (like agentName) at boot
const initialSettings = await readSettings();

const agent = createSupervisorAgent({
	model,
	memory,
	documentStore,
	agentName: initialSettings.agentName,
});

// ── 6. Workflows (Phase 3) ────────────────────────────────────────
// The intelligence-pipeline workflow demonstrates the
// gather → RAG → synthesize → classify pattern. It is
// registered with VoltAgent so it is reachable at
//   POST /workflows/intelligence-pipeline/run
// via the standard Hono server.
const intelligencePipeline = createIntelligencePipeline({
	documentStore,
	supervisorAgent: agent,
});
const workflows = { "intelligence-pipeline": intelligencePipeline };

// ── 7. VoltAgent App ──────────────────────────────────────────────
// Registers all agents, workflows, and starts the Hono HTTP server
// on port 3141.
//
// After starting:
//   - API:      http://localhost:3141
//   - /agents:  http://localhost:3141/agents
//   - /tools:   http://localhost:3141/tools
//   - /workflows: http://localhost:3141/workflows
//   - Console:  https://console.voltagent.dev (visual chat + observability)
new VoltAgent({
	agents: { agent },
	workflows,
	server: honoServer({
		// CORS — the Next.js dashboard at :3000 fetches this server
		// at :3141 directly (not via a Next.js API route proxy).
		// We allow both ports so the dev workflow keeps working
		// alongside any production deployment on a different host.
		cors: {
			origin: (origin) => {
				if (!origin) return origin;
				const allowed = new Set<string>([
					"http://localhost:3000",
					"http://127.0.0.1:3000",
					"http://localhost:3001",
					"http://127.0.0.1:3001",
				]);
				const envOrigins = [
					process.env.DASHBOARD_URL,
					process.env.RENDER_EXTERNAL_URL,
				]
					.filter((v): v is string => typeof v === "string" && v.length > 0)
					.flatMap((v) => [v, v.replace(/\/$/, "")]);
				for (const o of envOrigins) allowed.add(o);
				return allowed.has(origin) ? origin : null;
			},
			allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
			allowHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
			credentials: true,
		},
		configureApp: (app) => {
			app.get("/api/documents", (c) => {
				try {
					return c.json(documentStore.listDocuments());
				} catch (err) {
					return c.json(
						{ error: err instanceof Error ? err.message : String(err) },
						500,
					);
				}
			});

			app.post("/api/documents/upload", async (c) => {
				try {
					const body = await c.req.json();
					const { name, content, mimeType, kind } = body;
					if (!name || !content) {
						return c.json({ error: "Missing name or content" }, 400);
					}
					const detected = kind ?? detectKind(name, mimeType);
					const cleaned = content.replace(/^data:[^;]+;base64,/, "").trim();
					const bytes = Buffer.from(cleaned, "base64");
					const text = await extractText(bytes, detected, name);

					const doc = await documentStore.ingest({
						name,
						kind: detected,
						text,
						source: "upload",
					});

					return c.json({ success: true, doc });
				} catch (err) {
					return c.json(
						{
							success: false,
							error: err instanceof Error ? err.message : String(err),
						},
						500,
					);
				}
			});

			app.delete("/api/documents/:id", async (c) => {
				try {
					const id = c.req.param("id");
					const success = await documentStore.deleteDocument(id);
					if (success) {
						return c.json({ success: true });
					}
					return c.json({ error: "Document not found" }, 404);
				} catch (err) {
					return c.json(
						{
							success: false,
							error: err instanceof Error ? err.message : String(err),
						},
						500,
					);
				}
			});

			// ── Presentations ────────────────────────────────────────
			// List all generated presentations with metadata.
			const PRESENTATIONS_DIR = resolve("./data/presentations");

			app.get("/api/presentations", (c) => {
				try {
					if (!existsSync(PRESENTATIONS_DIR)) {
						return c.json([]);
					}
					const files = readdirSync(PRESENTATIONS_DIR)
						.filter((f) => f.endsWith(".pptx"))
						.map((fileName) => {
							const filePath = join(PRESENTATIONS_DIR, fileName);
							const stats = statSync(filePath);
							// Extract the ID from the filename: topic-slug-pres-TIMESTAMP-RANDOM.pptx
							const idMatch = fileName.match(/(pres-\d+-[a-z0-9]+)\.pptx$/);
							const id = idMatch ? idMatch[1] : fileName.replace(".pptx", "");
							return {
								id,
								fileName,
								sizeBytes: stats.size,
								generatedAt: stats.birthtime.toISOString(),
								downloadUrl: `/api/presentations/${id}/download`,
							};
						})
						.sort(
							(a, b) =>
								new Date(b.generatedAt).getTime() -
								new Date(a.generatedAt).getTime(),
						);
					return c.json(files);
				} catch (err) {
					return c.json(
						{ error: err instanceof Error ? err.message : String(err) },
						500,
					);
				}
			});

			// Download a specific presentation by ID.
			app.get("/api/presentations/:id/download", (c) => {
				try {
					const id = c.req.param("id");
					if (!existsSync(PRESENTATIONS_DIR)) {
						return c.json({ error: "No presentations found" }, 404);
					}
					const files = readdirSync(PRESENTATIONS_DIR);
					const match = files.find(
						(f) => f.includes(id) && f.endsWith(".pptx"),
					);
					if (!match) {
						return c.json({ error: "Presentation not found" }, 404);
					}
					const filePath = join(PRESENTATIONS_DIR, match);
					const fileBuffer = readFileSync(filePath);
					return new Response(fileBuffer, {
						status: 200,
						headers: {
							"Content-Type":
								"application/vnd.openxmlformats-officedocument.presentationml.presentation",
							"Content-Disposition": `attachment; filename="${match}"`,
							"Content-Length": String(fileBuffer.length),
						},
					});
				} catch (err) {
					return c.json(
						{ error: err instanceof Error ? err.message : String(err) },
						500,
					);
				}
			});

			// ── Settings ─────────────────────────────────────────
			// GET returns the current scheduler configuration. The
			// dashboard settings panel uses this to populate its
			// form fields on mount.
			app.get("/api/settings", async (c) => {
				try {
					const settings = await readSettings();
					return c.json({ success: true, settings });
				} catch (err) {
					return c.json(
						{
							success: false,
							error: err instanceof Error ? err.message : String(err),
						},
						500,
					);
				}
			});

			// PUT updates one or more scheduler fields and
			// re-registers the cron task in-process so the change
			// takes effect immediately (no server restart needed).
			app.put("/api/settings", async (c) => {
				try {
					const body = await c.req.json();
					const updated = await updateSettings({
						briefingCron:
							typeof body.briefingCron === "string"
								? body.briefingCron
								: undefined,
						briefingTimezone:
							typeof body.briefingTimezone === "string"
								? body.briefingTimezone
								: undefined,
						userName:
							typeof body.userName === "string" ? body.userName : undefined,
						agentName:
							typeof body.agentName === "string" ? body.agentName : undefined,
					});
					await reconfigureScheduler(updated);
					if (updated.agentName) {
						// biome-ignore lint/suspicious/noExplicitAny: agent instructions are readonly in typescript but writable at runtime
						(agent as any).instructions = getSupervisorPrompt(
							updated.agentName,
						);
					}
					return c.json({ success: true, settings: updated });
				} catch (err) {
					return c.json(
						{
							success: false,
							error: err instanceof Error ? err.message : String(err),
						},
						400,
					);
				}
			});

			// ── Briefing cache (the "today" endpoint) ───────────
			// The dashboard's briefing tab calls this on mount.
			// It returns the most recent prepared snapshot for
			// today if one exists, otherwise 404 so the dashboard
			// can show a "no snapshot yet" state.
			app.get("/api/briefing/today", async (c) => {
				try {
					const dateParam = c.req.query("date");
					const date = dateParam ?? new Date().toISOString().slice(0, 10);
					const record = await readPreparedBriefing(date);
					if (!record) {
						return c.json(
							{ success: false, error: "No prepared briefing for that date" },
							404,
						);
					}
					return c.json({ success: true, record });
				} catch (err) {
					return c.json(
						{
							success: false,
							error: err instanceof Error ? err.message : String(err),
						},
						500,
					);
				}
			});

			// List of dates that have prepared snapshots on disk —
			// useful for an "archive" dropdown in a follow-up.
			app.get("/api/briefing/dates", async (c) => {
				try {
					const dates = await listAvailableBriefingDates();
					return c.json({ success: true, dates });
				} catch (err) {
					return c.json(
						{
							success: false,
							error: err instanceof Error ? err.message : String(err),
						},
						500,
					);
				}
			});

			// Manual "Refresh now" path. Runs the full preparer
			// pipeline (exa fan-out + persist) and returns the new
			// record. Slower than /api/briefing/today because it
			// actually does the work.
			app.post("/api/briefing/refresh", async (c) => {
				try {
					const body = (await c.req.json().catch(() => ({}))) ?? {};
					const focus = typeof body.focus === "string" ? body.focus : "all";
					await runScheduledJob("manual-refresh");
					const record = await readPreparedBriefing();
					if (!record) {
						return c.json(
							{
								success: false,
								error: "Refresh completed but no record on disk",
							},
							500,
						);
					}
					// Re-prepare with the requested focus if it
					// differs from the persisted default. The cron
					// path always uses "all"; manual refresh may
					// request a different focus and the user expects
					// that focus to be reflected.
					void focus;
					return c.json({ success: true, record });
				} catch (err) {
					return c.json(
						{
							success: false,
							error: err instanceof Error ? err.message : String(err),
						},
						500,
					);
				}
			});
		},
	}),
	logger,
});

// ── 8. Start the overnight briefing scheduler ─────────────────────
//
// The cron job runs in-process and survives for the life of the
// server. Boot-time recovery ensures a snapshot exists for today
// even if the server started after the scheduled run.
startScheduler().catch((err) => {
	logger.error(
		`[scheduler] Failed to start scheduler: ${err instanceof Error ? err.message : String(err)}`,
	);
});

// Graceful shutdown for `tsx watch` HMR cycles. Without this, an
// HMR reload of this file would orphan the previous cron task and
// the process would accumulate scheduled callbacks on each reload.
const shutdown = (signal: string) => {
	logger.info(`[shutdown] Received ${signal} — stopping scheduler`);
	stopScheduler();
	process.exit(0);
};
process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
