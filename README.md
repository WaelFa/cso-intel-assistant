# CSO Strategic Intelligence Assistant

A personal AI workspace for a **Chief Strategy Officer (CSO)** of an international financial centre. The app combines a multi-agent VoltAgent backend (chat, document RAG, live web search, scheduled briefings, presentation generation) with a Next.js executive dashboard.

The product persona is **Jarvis** — a calm, precise chief-of-staff style assistant that turns raw market, regulatory, competitive, and operational data into **decision-ready intelligence** for the CSO.

---

## Highlights

- **Multi-agent supervisor + 4 specialists** (market, regulatory, competitive, executive comms) orchestrated by a CSO-facing supervisor
- **Document RAG** — upload PDF / DOCX / TXT / MD, chunk, embed (OpenRouter `text-embedding-3-small`), and answer questions with inline citations
- **Curated seed corpus** of 3 strategic MDs that bootstrap the knowledge base on first boot
- **Live web intelligence** via [Exa.ai](https://exa.ai) for market signals, competitor SWOTs, and regulatory updates (silent fallback to curated data when `EXA_API_KEY` is unset)
- **Daily Executive Briefing** with 🔴 Critical / 🟡 Monitoring / 🟢 Opportunities + a 4-tile KPI strip
- **Risk Indicators dashboard** across market, regulatory, competitive, operational, and geopolitical categories
- **Performance Metrics** — KPIs and initiative progress with on_track / at_risk / off_track status
- **Overnight scheduler** (`node-cron`) that prepares and persists a daily briefing snapshot, with hot-reloadable settings from the dashboard
- **Real .pptx generation** in three McKinsey-style frameworks (SCR / SWOT / Executive Summary) — downloadable from the dashboard
- **Next.js executive dashboard** (App Router) with a chat panel (SSE streaming), briefing tab, document library, agent status panel, settings, and a 5-card "agent fleet" view
- **In-process HTTP API** (Hono) exposing the agents, workflows, documents, presentations, and briefing cache

---

## Stack

| Layer            | Tech                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------ |
| Agent framework  | [VoltAgent](https://voltagent.dev) 2.x (TypeScript)                                        |
| HTTP server      | Hono via `@voltagent/server-hono`                                                          |
| LLM provider     | [OpenRouter](https://openrouter.ai) — OpenAI-compatible API, default `openai/gpt-4o-mini`  |
| Embeddings       | `openai/text-embedding-3-small` (1536-dim) via OpenRouter                                  |
| Memory           | LibSQL (SQLite) at `./.voltagent/memory.db` + in-memory vector store                       |
| Live web search  | [Exa.ai](https://exa.ai) (`exa-js`) — optional, 15-min cache                               |
| Document parsers | `pdf-parse`, `mammoth` (lazy-loaded on demand)                                             |
| Scheduler        | `node-cron` (in-process; hot-reloadable from the settings panel)                           |
| Presentations    | `pptxgenjs` (McKinsey-style .pptx generation)                                              |
| Dashboard        | Next.js 16 App Router (React 19, lucide-react)                                             |
| Tooling          | TypeScript 5, Biome (lint), tsdown (build), tsx (dev)                                      |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    Next.js Dashboard  (:3000)                 │
│  Chat (SSE) │ Briefing │ Documents │ Settings │ Agent Panel  │
└──────────────────────────────┬───────────────────────────────┘
                               │ fetch / SSE
                               ▼
┌──────────────────────────────────────────────────────────────┐
│              Hono Server / VoltAgent  (:3141)                │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │            Supervisor — "cso-intel-assistant"          │  │
│  │   direct tools: briefing, risk, performance,           │  │
│  │                 upload_doc, retrieve_doc              │  │
│  └────────┬──────────┬──────────┬──────────┬──────────────┘  │
│           ▼          ▼          ▼          ▼                  │
│  ┌────────────┐ ┌─────────┐ ┌────────────┐ ┌──────────────┐  │
│  │  Market    │ │ Regula- │ │ Competitive│ │  Executive   │  │
│  │  Intel     │ │ tory    │ │ Intel      │ │  Comms       │  │
│  │ (Exa+mock) │ │ (Exa+   │ │ (Exa+SWOT) │ │ (draft+      │  │
│  │            │ │ curated)│ │            │ │  .pptx)      │  │
│  └────────────┘ └─────────┘ └────────────┘ └──────────────┘  │
│                                                              │
│  Workflows:  intelligence-pipeline (rag → synth → classify)   │
│  Services:   briefing-preparer, exa-search, settings-store    │
│  Jobs:       node-cron scheduler → briefings/{date}.json      │
│  RAG:        DocumentStore (InMemoryVectorAdapter + chunks)   │
│  Memory:     LibSQL conversation store + vector memory        │
└──────────────────────────────────────────────────────────────┘
```

### Source layout

```
.
├── src/
│   ├── index.ts                  # Wiring: logger → memory → LLM → retriever
│   │                             #   → agents → workflow → server → scheduler
│   ├── agents/                   # Factory functions (DI) for 5 agents
│   │   ├── agents.ts             #   createSupervisor / Market / Regulatory /
│   │   │                         #   Competitive / ExecComms
│   │   └── index.ts              # Re-exports
│   ├── prompts/                  # RACE-framework system prompts (5 total)
│   ├── tools/                    # 10 Zod-typed tools (see below)
│   ├── retriever/                # DocumentStore + chunker + parser dispatch
│   ├── data/seed-documents.ts    # Boot-time seed loader (data/seed/*.md)
│   ├── services/
│   │   ├── briefing-preparer.ts  # Exa fan-out + curated fallback → daily JSON
│   │   ├── exa-search.ts         # Exa client + 15-min cache (market/competitor/reg)
│   │   └── settings-store.ts     # data/settings.json read/write (validated)
│   ├── jobs/schedule-briefing.ts # node-cron scheduler + boot recovery
│   └── workflows/
│       └── intelligence-pipeline.ts  # 3-step gather → RAG → synth → classify
│
├── dashboard/                    # Next.js 16 App Router
│   ├── app/                      #   /, /daily-briefing, /documents, /config, /api
│   ├── components/               #   ChatPanel, BriefingPanel, DocumentLibrary,
│   │                             #   AgentStatusPanel, SchedulerCard, SettingsPanel…
│   ├── context/DashboardContext.tsx
│   └── hooks/                    #   useChat, useDocuments, useBriefing, useAgents…
│
├── data/
│   ├── seed/                     # 3 curated MDs indexed on every boot
│   ├── briefings/{date}.json     # Persisted daily briefing snapshots
│   ├── presentations/            # Generated .pptx files (downloadable)
│   └── settings.json             # Cron expression + timezone (hot-reloadable)
│
├── scripts/
│   ├── run-all.js                # Concurrent dev: backend (3141) + dashboard (3000)
│   └── test-upload.js            # Smoke test the document upload endpoint
│
└── docs/                         # Long-form design notes
    ├── 00-voltagent-foundations.md
    ├── 01-multi-agent-architecture.md
    ├── 02-tools-and-structured-output.md
    ├── 03-phase-3-rag.md
    ├── implementation_plan.md
    └── progress.md               # Phase-by-phase build log
```

---

## Features

### 1. Multi-agent orchestration (Phase 1)

A supervisor agent (`cso-intel-assistant`) routes every CSO message to the right specialist. Sub-agents appear as callable tools to the supervisor; the LLM decides which to invoke based on the question.

| Sub-agent               | Specialisation                                              | Bound tool                |
| ----------------------- | ----------------------------------------------------------- | ------------------------- |
| `market-intelligence`   | Capital flows, investor sentiment, FDI, sector trends       | `search_market_intelligence` |
| `regulatory-intelligence` | DFSA / MAS / ESMA / FSRA / IFSCA / OECD policy shifts     | `track_regulatory_changes` |
| `competitive-intelligence` | DIFC, ADGM, QFC, GIFT City, AIFC, NIFC, Singapore, HK, Lux, Ireland | `analyze_competitor`      |
| `executive-communications` | Board papers, memos, talking points, McKinsey-style decks | `draft_executive_content`, `generate_strategic_presentation` |

All agents are created via factory functions (`createXxxAgent({ model, memory, documentStore })`) so dependencies are injected from `src/index.ts` — no module-level singletons.

### 2. Strategic intelligence tools (Phase 2)

| Tool                          | What it returns                                                                    |
| ----------------------------- | ---------------------------------------------------------------------------------- |
| `generate_daily_briefing`     | Critical / Monitoring / Opportunities stacks + 4-tile KPI strip (focus-filterable) |
| `get_risk_indicators`         | Risk levels (🔴/🟡/🟢) across market/regulatory/competitive/operational/geopolitical |
| `get_performance_metrics`     | 7 KPIs + 5 strategic initiatives with on_track / at_risk / off_track status         |
| `search_market_intelligence`  | Topic-keyed signals with magnitude, region, inferred trend (Exa live or curated)   |
| `analyze_competitor`          | SWOT + threat level + benchmark delta + 90-day response options                    |
| `track_regulatory_changes`    | Jurisdiction × sector × severity filter; status, impact, action-required           |
| `draft_executive_content`     | Structured scaffold (board paper, memo, talking points, etc.) for the exec-comms sub-agent to fill |
| `generate_strategic_presentation` | Real downloadable .pptx — SCR, SWOT, or Executive Summary framework            |

The supervisor's own direct tools are briefing, risk, performance, upload, retrieve. Everything else is reached by delegating to a sub-agent.

### 3. Document RAG (Phase 3)

- **Upload** PDF / DOCX / TXT / MD via `POST /api/documents/upload` (base64) or the supervisor's `upload_document` tool
- **Parse** with `pdf-parse` (PDF) or `mammoth` (DOCX), or pass TXT/MD through raw UTF-8
- **Chunk** with a recursive paragraph- and sentence-aware splitter (1,000 chars, 200-char overlap)
- **Embed** with OpenRouter's `openai/text-embedding-3-small` (1536-dim)
- **Store** in an `InMemoryVectorAdapter` with first-class source attribution (`documentId`, `documentName`, `chunkIndex`)
- **Retrieve** via `retrieve_documents` tool → top-k chunks with scores; the supervisor is prompted to call it **exactly once** per question, then synthesise in prose with inline citations (`[Source: filename.pdf, chunk 4, relevance 0.82]`)
- **Seed corpus**: 3 hand-curated MDs in `data/seed/` are indexed on every boot (idempotency check by `(name, source)` pair)

The `intelligence-pipeline` workflow demonstrates a 3-step pattern: `rag → synthesize (supervisor agent with chunks in context) → package (merge urgency, sources, answer)`. Reachable at `POST /workflows/intelligence-pipeline/run`.

### 4. Overnight briefing scheduler (Phase 5)

- `node-cron` task running in-process, registered from `data/settings.json`
- Default schedule: `40 7 * * *` in `UTC` (overridable from the dashboard Settings panel)
- **Boot recovery** — if the server starts after today's scheduled run was missed, a snapshot is prepared immediately
- **Manual refresh** — `POST /api/briefing/refresh` runs the same path on demand
- **Persistence** — each daily snapshot is written atomically to `data/briefings/{YYYY-MM-DD}.json` with `isLive`, `executedMs`, and per-bucket source provenance
- **Hot reload** — updating the cron in the dashboard calls `reconfigureScheduler()` and re-binds the task without a server restart

### 5. Briefing preparer (Phase 6)

`src/services/briefing-preparer.ts` fans out to Exa in parallel for the **market**, **competitor**, and **regulatory** buckets. Each call is wrapped in `safeExaCall` so a single failure doesn't blank the briefing. If Exa is unavailable or every bucket fails, it falls back to the curated `dailyBriefingTool` data so the dashboard never shows an empty grid.

### 6. Executive dashboard (Phase 4)

A Next.js 16 app (App Router) that talks directly to the Hono backend on `http://localhost:3141` (CORS is configured to allow `localhost:3000`).

- **Chat** — SSE streaming from `/agents/cso-intel-assistant/stream`; markdown rendering with **inline citation extraction**; persistent `conversationId` so the supervisor's LibSQL memory works
- **Daily Briefing** — 🔴/🟡/🟢 stacks + KPI strip; domain filter tabs
- **Documents** — drag-and-drop upload, library view with kind badges + chunk counts, delete (calls `DELETE /api/documents/:id`)
- **Presentations** — list generated .pptx files with download links
- **Agent Status Panel** — 5-card view (Supervisor, Market, Regulatory, Competitive, Scheduler) with simulated activation based on the active prompt
- **Scheduler Card** — meeting confirm/decline UI with status state machine
- **Settings Panel** — edit the briefing cron + timezone; PUT `/api/settings` hot-reloads the scheduler
- **Command Palette** — keyboard-driven quick actions

### 7. Observability endpoints

The Hono server exposes the standard VoltAgent surfaces plus a few custom ones:

| Method | Path                                  | Purpose                                |
| ------ | ------------------------------------- | -------------------------------------- |
| GET    | `/agents`                             | List registered agents                 |
| GET    | `/tools`                              | List tools bound to the supervisor     |
| GET    | `/workflows`                          | List workflows                         |
| POST   | `/agents/:id/text`                    | Send a chat turn (non-streaming)       |
| POST   | `/agents/:id/stream`                  | SSE streaming chat                     |
| POST   | `/workflows/:id/run`                  | Trigger a workflow                     |
| POST   | `/tools/:name/execute`                | Direct tool call (for testing)         |
| GET    | `/api/documents`                      | List indexed documents                 |
| POST   | `/api/documents/upload`               | Upload + ingest a document             |
| DELETE | `/api/documents/:id`                  | Remove a document                      |
| GET    | `/api/presentations`                  | List generated .pptx files             |
| GET    | `/api/presentations/:id/download`      | Download a .pptx                       |
| GET    | `/api/briefing/today?date=YYYY-MM-DD` | Read the prepared daily snapshot       |
| GET    | `/api/briefing/dates`                 | List available snapshot dates          |
| POST   | `/api/briefing/refresh`               | Force a manual briefing run            |
| GET    | `/api/settings`                       | Read scheduler settings                |
| PUT    | `/api/settings`                       | Update scheduler settings (hot-reload) |

---

## Running the app

### Prerequisites

- **Node.js ≥ 20.19**
- An [OpenRouter](https://openrouter.ai/keys) API key (`sk-or-v1-...`)
- (Optional) An [Exa.ai](https://exa.ai) API key — enables live web search; without it the tools silently fall back to curated data
- (Optional) macOS / Linux / WSL — Windows works with WSL

### 1. Install

```bash
git clone <repo> cso-intel-assistant
cd cso-intel-assistant
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
$EDITOR .env
```

Required:

```bash
OPENAI_BASE_URL="https://openrouter.ai/api/v1"
OPENAI_API_KEY="sk-or-v1-..."
```

Optional:

```bash
EXA_API_KEY="..."   # live market / competitor / regulatory search
MODEL_ID="openai/gpt-4o-mini"   # default; see comments in src/index.ts for the full model menu
```

### 3. Start the backend (port 3141)

```bash
npm run dev
```

This launches the Hono server via `tsx watch` (HMR on save), seeds the knowledge base from `data/seed/`, and starts the briefing cron. You'll see logs like:

```
[seed] 3 ingested, 0 skipped, 0 error(s)
[scheduler] Cron registered: "40 7 * * *" (UTC)
Server running on http://localhost:3141
```

To chat with the agent from your terminal, open the VoltAgent console at **https://console.voltagent.dev** and point it at your local server.

### 4. Start the dashboard (port 3000)

In a second terminal:

```bash
cd dashboard
npm install
npm run dev
```

Open **http://localhost:3000** to see the executive dashboard.

### 5. Or run both at once

From the repo root:

```bash
npm run dev:all
```

This launches the backend and dashboard concurrently (see `scripts/run-all.js`) and starts the frontend as soon as the backend logs `[seed]` or `Server running`.

### 6. Production build

```bash
npm run build       # tsdown → dist/
npm start           # node dist/index.js  (port 3141)
```

A multi-stage `Dockerfile` is included (`node:20-alpine`, exposes 3141).

### 7. Other scripts

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # biome check
npm run lint:fix    # biome check --write
npm run volt        # VoltAgent CLI helpers
```

---

## Verifying it works

Once both servers are up:

```bash
# Health: list registered agents
curl -s http://localhost:3141/agents | jq

# Trigger the daily briefing tool directly
curl -s http://localhost:3141/tools/generate_daily_briefing/execute \
  -H 'content-type: application/json' \
  -d '{"focus":"all"}' | jq

# Send a chat turn to the supervisor
curl -s http://localhost:3141/agents/cso-intel-assistant/text \
  -H 'content-type: application/json' \
  -d '{"input":"Give me today’s executive briefing.","conversationId":"demo"}' | jq

# Run the RAG + synthesis pipeline as a workflow
curl -s http://localhost:3141/workflows/intelligence-pipeline/run \
  -H 'content-type: application/json' \
  -d '{"input":{"question":"What is the CSO strategic narrative for 2026?"}}' | jq

# Read today's prepared briefing snapshot
curl -s http://localhost:3141/api/briefing/today | jq
```

A scripted smoke test for the document upload endpoint is in `scripts/test-upload.js`.

---

## Configuring the briefing schedule

The cron expression and timezone are persisted to `data/settings.json` and reloaded at boot. You can edit the file directly, or change it from the dashboard Settings panel — the PUT endpoint validates with Zod and re-binds the cron task in-process.

```json
{
  "briefingCron": "40 7 * * *",
  "briefingTimezone": "UTC"
}
```

Use [crontab.guru](https://crontab.guru/) to compose expressions. `node-cron` (5-field) syntax — minute, hour, day-of-month, month, day-of-week.

---

## Adding documents to the knowledge base

There are three ways:

1. **Drop a file in `data/seed/`** — re-indexed on every boot. Markdown is the recommended format (committable, diff-friendly).
2. **Upload from the dashboard** — Documents tab → drag-and-drop a PDF/DOCX/TXT/MD. Stored in memory for the lifetime of the server.
3. **Have the supervisor upload** — chat with Jarvis and say *"Upload this file: …"*; the supervisor calls `upload_document` and then `retrieve_documents` to answer follow-up questions.

---

## Notes & gotchas

- **Vector store is in-memory** — the RAG corpus is rebuilt on every restart (3 MDs by default). For durable storage, swap `InMemoryVectorAdapter` for a persistent adapter in `src/retriever/index.ts` and `src/index.ts`.
- **Default model is `openai/gpt-4o-mini`** for tool-calling reliability. Cheaper models (e.g. `deepseek/deepseek-chat-v3.2`) work but may need stronger prompts to bound tool-call loops. `maxSteps: 8` is set on all agents as a safety net.
- **Exa fallback is silent** — without `EXA_API_KEY`, the market/competitor/regulatory tools use curated mock data and return `isLive: false`. With a key, they return live web results with `isLive: true` and source URLs.
- **CORS** allows `http://localhost:3000` and `3001` for the dashboard. Add your production host to `cors.origin` in `src/index.ts` if deploying.

---

## Roadmap

Phases 1–6 are complete. The original [implementation plan](./docs/implementation_plan.md) and the [progress log](./docs/progress.md) track what shipped and what was deliberately cut (auth, real OCR for scanned PDFs, persistent vector storage, monorepo cleanup).

Likely next steps if extending:

- Persist the vector store to SQLite (`@voltagent/libsql` already supports this)
- Add OCR for scanned PDFs (`tesseract.js` or a managed API)
- Wire authentication in front of the dashboard
- Replace the single `page.tsx` with component-split pages and a proper Next.js routing tree
- Add more sub-agents (e.g. macro-economics, geopolitical risk) as the supervisor's tool list grows

---

## License

Private project — not currently licensed for redistribution.
