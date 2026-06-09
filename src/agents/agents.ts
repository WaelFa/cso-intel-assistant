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
	getSupervisorPrompt,
} from "../prompts/index.js";
import type { DocumentStore } from "../retriever/index.js";
import {
	competitorAnalysisTool,
	createDocumentRetrievalTool,
	createDocumentUploadTool,
	dailyBriefingTool,
	draftContentTool,
	generatePresentationTool,
	marketIntelligenceTool,
	performanceMetricsTool,
	regulatoryTrackerTool,
	riskIndicatorsTool,
} from "../tools/index.js";

/** Shared config that every agent needs */
interface AgentDeps {
	model: LanguageModel;
	memory?: Memory;
	documentStore?: DocumentStore;
	agentName?: string;
}

/** Max tool-call steps for any single agent turn. Bounds runaway loops. */
const AGENT_MAX_STEPS = 8;

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
		maxSteps: AGENT_MAX_STEPS,
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
		maxSteps: AGENT_MAX_STEPS,
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
		maxSteps: AGENT_MAX_STEPS,
	});
}

/**
 * Strategic Output Agent (formerly Executive Communications).
 * Drafts board papers, memos, talking points, and presentations.
 * Also generates real downloadable McKinsey-style .pptx decks.
 *
 * Tools:
 *   - draft_executive_content (structured scaffold the agent fills with prose)
 *   - generate_strategic_presentation (real .pptx file generation)
 */
export function createExecCommsAgent({ model }: AgentDeps) {
	return new Agent({
		name: "executive-communications",
		instructions: EXEC_COMMS_PROMPT,
		model,
		tools: [draftContentTool, generatePresentationTool],
		maxSteps: AGENT_MAX_STEPS,
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
 *   - generate_daily_briefing   (P0 briefing panel)
 *   - get_risk_indicators       (P1 risk dashboard)
 *   - get_performance_metrics   (P2 KPI strip)
 *   - upload_document           (Phase 3 RAG ingest)
 *   - retrieve_documents        (Phase 3 RAG Q&A)
 */
export function createSupervisorAgent({
	model,
	memory,
	documentStore,
	agentName = "Jarvis",
}: AgentDeps) {
	// First, create the specialist sub-agents
	const marketIntel = createMarketIntelAgent({ model });
	const regulatoryIntel = createRegulatoryIntelAgent({ model });
	const competitorIntel = createCompetitorIntelAgent({ model });
	const execComms = createExecCommsAgent({ model });

	// Document tools are optional — only registered if a store was provided.
	// This keeps the agent constructable in unit tests without seeding a store.
	const documentTools = documentStore
		? [
				createDocumentUploadTool(documentStore),
				createDocumentRetrievalTool(documentStore),
			]
		: [];

	// Then create the supervisor that orchestrates them
	return new Agent({
		name: "cso-intel-assistant",
		instructions: getSupervisorPrompt(agentName),
		model,
		memory,
		// Supervisor's own tools (in addition to its sub-agents)
		tools: [
			dailyBriefingTool,
			riskIndicatorsTool,
			performanceMetricsTool,
			...documentTools,
		],
		// Sub-agents are registered here — VoltAgent automatically
		// exposes them as tools the supervisor can call
		subAgents: [marketIntel, regulatoryIntel, competitorIntel, execComms],
		maxSteps: AGENT_MAX_STEPS,
	});
}
