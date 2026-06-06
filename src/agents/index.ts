// ──────────────────────────────────────────────────────────────────
// Agent Definitions
//
// Each agent is a specialist with its own system prompt and tools.
// The supervisor orchestrates them all.
//
// Read docs/01-multi-agent-architecture.md to understand the
// supervisor + sub-agent pattern.
// ──────────────────────────────────────────────────────────────────

export {
  createSupervisorAgent,
  createMarketIntelAgent,
  createRegulatoryIntelAgent,
  createCompetitorIntelAgent,
  createExecCommsAgent,
} from "./agents.js";
