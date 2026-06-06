// ──────────────────────────────────────────────────────────────────
// CSO Strategic Intelligence Assistant — Main Entry Point
//
// This file wires everything together:
//   1. Logger   → structured logging (Pino)
//   2. Memory   → conversation persistence (LibSQL)
//   3. LLM      → language model provider (OpenRouter)
//   4. Agents   → supervisor + specialized sub-agents
//   5. Server   → HTTP/WebSocket endpoints (Hono)
//
// Read docs/00-voltagent-foundations.md for a detailed walkthrough
// of each component and why it exists.
// ──────────────────────────────────────────────────────────────────

import "dotenv/config";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { Memory, VoltAgent } from "@voltagent/core";
import { LibSQLMemoryAdapter } from "@voltagent/libsql";
import { createPinoLogger } from "@voltagent/logger";
import { honoServer } from "@voltagent/server-hono";

import { createSupervisorAgent } from "./agents/index.js";

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
// See docs/00-voltagent-foundations.md → "Memory & LibSQL" section.
const memory = new Memory({
  storage: new LibSQLMemoryAdapter({
    url: "file:./.voltagent/memory.db",
    logger: logger.child({ component: "libsql" }),
  }),
});

// ── 3. LLM Provider ──────────────────────────────────────────────
// OpenRouter gives us access to 100+ models through one API key.
// We use the OpenAI-compatible protocol (the de facto standard).
//
// Change the model ID to try different models:
//   "openai/gpt-4o-mini"           → Fast & cheap (default)
//   "openai/gpt-4o"                → More capable
//   "anthropic/claude-3.5-sonnet"  → Great for analysis
//   "google/gemini-2.0-flash"      → Google's latest
const openrouter = createOpenAICompatible({
  name: "openrouter",
  baseURL: process.env.OPENAI_BASE_URL ?? "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENAI_API_KEY ?? "",
});

const model = openrouter(process.env.MODEL_ID ?? "openai/gpt-4o-mini");

// ── 4. Agents ─────────────────────────────────────────────────────
// The supervisor agent is the main agent the CSO talks to.
// It has 4 specialized sub-agents:
//   - Market Intelligence
//   - Regulatory Intelligence
//   - Competitive Intelligence
//   - Executive Communications
//
// See docs/01-multi-agent-architecture.md for how this works.
const agent = createSupervisorAgent({ model, memory });

// ── 5. VoltAgent App ──────────────────────────────────────────────
// Registers all agents and starts the Hono HTTP server on port 3141.
//
// After starting:
//   - API:     http://localhost:3141
//   - Console: https://console.voltagent.dev (visual chat + observability)
new VoltAgent({
  agents: { agent },
  server: honoServer(),
  logger,
});
