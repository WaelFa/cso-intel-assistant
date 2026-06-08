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
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { InMemoryVectorAdapter, Memory, VoltAgent } from "@voltagent/core";
import { LibSQLMemoryAdapter } from "@voltagent/libsql";
import { createPinoLogger } from "@voltagent/logger";
import { honoServer } from "@voltagent/server-hono";

import { createSupervisorAgent } from "./agents/index.js";
import { seedDocuments } from "./data/seed-documents.js";
import { DocumentStore, createAiSdkEmbedder } from "./retriever/index.js";
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

// ── 5. Agents ─────────────────────────────────────────────────────
// The supervisor agent is the main agent the CSO talks to.
// It has 4 specialized sub-agents:
//   - Market Intelligence
//   - Regulatory Intelligence
//   - Competitive Intelligence
//   - Executive Communications
//
// Plus 5 direct supervisor tools (3 from Phase 2, 2 from Phase 3).
//
// See docs/01-multi-agent-architecture.md for how this works.
const agent = createSupervisorAgent({ model, memory, documentStore });

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
	server: honoServer(),
	logger,
});
