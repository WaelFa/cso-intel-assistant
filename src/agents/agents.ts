// ──────────────────────────────────────────────────────────────────
// Agent Factory Functions
//
// We use factory functions (createXxxAgent) instead of exporting
// agent instances directly because agents need shared dependencies
// (model, memory) that are configured in index.ts.
//
// This pattern is called "dependency injection" — the agents
// don't create their own dependencies, they receive them.
// ──────────────────────────────────────────────────────────────────

import type { LanguageModel } from "ai";
import { Agent, type Memory } from "@voltagent/core";
import {
  SUPERVISOR_PROMPT,
  MARKET_INTEL_PROMPT,
  REGULATORY_INTEL_PROMPT,
  COMPETITOR_INTEL_PROMPT,
  EXEC_COMMS_PROMPT,
} from "../prompts/index.js";

/** Shared config that every agent needs */
interface AgentDeps {
  model: LanguageModel;
  memory?: Memory;
}

// ── Sub-Agents (specialists) ──────────────────────────────────────

/**
 * Market Intelligence sub-agent.
 * Specializes in capital flows, investor sentiment, and market trends.
 *
 * Note: No `memory` — sub-agents are stateless workers.
 * They receive a task, process it, and return a result.
 * Only the supervisor maintains conversation history.
 */
export function createMarketIntelAgent({ model }: AgentDeps) {
  return new Agent({
    name: "market-intelligence",
    instructions: MARKET_INTEL_PROMPT,
    model,
    // tools: [] ← will be added in Phase 2
  });
}

/**
 * Regulatory Intelligence sub-agent.
 * Tracks policy changes, regulatory developments, and legislative updates.
 */
export function createRegulatoryIntelAgent({ model }: AgentDeps) {
  return new Agent({
    name: "regulatory-intelligence",
    instructions: REGULATORY_INTEL_PROMPT,
    model,
  });
}

/**
 * Competitive Intelligence sub-agent.
 * Monitors rival financial centers and their strategic positioning.
 */
export function createCompetitorIntelAgent({ model }: AgentDeps) {
  return new Agent({
    name: "competitive-intelligence",
    instructions: COMPETITOR_INTEL_PROMPT,
    model,
  });
}

/**
 * Executive Communications sub-agent.
 * Drafts board papers, memos, talking points, and presentations.
 */
export function createExecCommsAgent({ model }: AgentDeps) {
  return new Agent({
    name: "executive-communications",
    instructions: EXEC_COMMS_PROMPT,
    model,
  });
}

// ── Supervisor (orchestrator) ─────────────────────────────────────

/**
 * CSO Supervisor agent — the main agent the user talks to.
 *
 * It receives all user messages and delegates to sub-agents
 * when specialized analysis is needed. Sub-agents appear as
 * callable "tools" to the supervisor — the LLM decides when
 * to use them based on the user's question.
 */
export function createSupervisorAgent({ model, memory }: AgentDeps) {
  // First, create the specialist sub-agents
  const marketIntel = createMarketIntelAgent({ model });
  const regulatoryIntel = createRegulatoryIntelAgent({ model });
  const competitorIntel = createCompetitorIntelAgent({ model });
  const execComms = createExecCommsAgent({ model });

  // Then create the supervisor that orchestrates them
  return new Agent({
    name: "cso-intel-assistant",
    instructions: SUPERVISOR_PROMPT,
    model,
    memory,
    // Sub-agents are registered here — VoltAgent automatically
    // exposes them as tools the supervisor can call
    subAgents: [marketIntel, regulatoryIntel, competitorIntel, execComms],
  });
}
