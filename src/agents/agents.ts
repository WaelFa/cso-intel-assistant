// ──────────────────────────────────────────────────────────────────
// Agent Factory Functions
//
// We use factory functions (createXxxAgent) instead of exporting
// agent instances directly because agents need shared dependencies
// (model, memory, tools) that are configured in index.ts.
//
// This pattern is called "dependency injection" — the agents
// don't create their own dependencies, they receive them.
// ──────────────────────────────────────────────────────────────────

import { Agent, type Memory } from "@voltagent/core";
import type { LanguageModel } from "ai";
import {
	COMPETITOR_INTEL_PROMPT,
	EXEC_COMMS_PROMPT,
	MARKET_INTEL_PROMPT,
	REGULATORY_INTEL_PROMPT,
	SUPERVISOR_PROMPT,
} from "../prompts/index.js";
import {
	competitorAnalysisTool,
	dailyBriefingTool,
	draftContentTool,
	marketIntelligenceTool,
	performanceMetricsTool,
	regulatoryTrackerTool,
	riskIndicatorsTool,
} from "../tools/index.js";

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
 * Tools: search_market_intelligence (live web search + curated fallback)
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
		tools: [marketIntelligenceTool],
	});
}

/**
 * Regulatory Intelligence sub-agent.
 * Tracks policy changes, regulatory developments, and legislative updates.
 *
 * Tools: track_regulatory_changes (jurisdiction × sector × severity filter)
 */
export function createRegulatoryIntelAgent({ model }: AgentDeps) {
	return new Agent({
		name: "regulatory-intelligence",
		instructions: REGULATORY_INTEL_PROMPT,
		model,
		tools: [regulatoryTrackerTool],
	});
}

/**
 * Competitive Intelligence sub-agent.
 * Monitors rival financial centers and their strategic positioning.
 *
 * Tools: analyze_competitor (SWOT-shaped benchmarking)
 */
export function createCompetitorIntelAgent({ model }: AgentDeps) {
	return new Agent({
		name: "competitive-intelligence",
		instructions: COMPETITOR_INTEL_PROMPT,
		model,
		tools: [competitorAnalysisTool],
	});
}

/**
 * Executive Communications sub-agent.
 * Drafts board papers, memos, talking points, and presentations.
 *
 * Tools: draft_executive_content (returns a structured scaffold the
 *        agent then fills with prose).
 */
export function createExecCommsAgent({ model }: AgentDeps) {
	return new Agent({
		name: "executive-communications",
		instructions: EXEC_COMMS_PROMPT,
		model,
		tools: [draftContentTool],
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
 *
 * Supervisor-only tools (in addition to its sub-agents):
 *   - generate_daily_briefing (P0 briefing panel)
 *   - get_risk_indicators     (P1 risk dashboard)
 *   - get_performance_metrics (P2 KPI strip)
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
		// Supervisor's own tools (in addition to its sub-agents)
		tools: [dailyBriefingTool, riskIndicatorsTool, performanceMetricsTool],
		// Sub-agents are registered here — VoltAgent automatically
		// exposes them as tools the supervisor can call
		subAgents: [marketIntel, regulatoryIntel, competitorIntel, execComms],
	});
}
