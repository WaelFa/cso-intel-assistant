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
import type { Logger } from "@voltagent/logger";
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
import { createLatencyHooks } from "./latency-hooks.js";

/** Shared config that every agent needs */
interface AgentDeps {
	model: LanguageModel;
	memory?: Memory;
	documentStore?: DocumentStore;
	agentName?: string;
	logger?: Logger;
}

/** Max tool-call steps per agent turn. Bounds runaway loops.
 *
 *  The supervisor needs the most headroom: a single user request can
 *  legitimately fan out to a direct tool (e.g. generate_daily_briefing)
 *  AND a sub-agent handoff (e.g. executive-communications for a deck)
 *  AND a follow-up synthesis step, which is 3 turns of LLM round-trips
 *  minimum. Setting this to 10 lets the supervisor finish a complex
 *  multi-agent request without truncating on `finishReason: "tool-calls"`
 *  and leaving the user with no visible response.
 *
 *  Sub-agents are bounded tighter (4 steps) because each one is a
 *  single-purpose specialist with at most 1–2 tools; if a sub-agent
 *  can't answer in 4 tool calls, the supervisor's delegation prompt
 *  needs tightening, not a higher step cap.
 */
const SUPERVISOR_MAX_STEPS = 10;
const SUB_AGENT_MAX_STEPS = 4;

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
export function createMarketIntelAgent({ model, logger }: AgentDeps) {
	return new Agent({
		name: "market-intelligence",
		instructions: MARKET_INTEL_PROMPT,
		model,
		tools: [marketIntelligenceTool],
		maxSteps: SUB_AGENT_MAX_STEPS,
		hooks: logger ? createLatencyHooks(logger) : undefined,
	});
}

/**
 * Regulatory Intelligence sub-agent.
 * Tracks policy changes, regulatory developments, and legislative updates.
 *
 * Tools: track_regulatory_changes (jurisdiction × sector × severity filter)
 */
export function createRegulatoryIntelAgent({ model, logger }: AgentDeps) {
	return new Agent({
		name: "regulatory-intelligence",
		instructions: REGULATORY_INTEL_PROMPT,
		model,
		tools: [regulatoryTrackerTool],
		maxSteps: SUB_AGENT_MAX_STEPS,
		hooks: logger ? createLatencyHooks(logger) : undefined,
	});
}

/**
 * Competitive Intelligence sub-agent.
 * Monitors rival financial centers and their strategic positioning.
 *
 * Tools: analyze_competitor (SWOT-shaped benchmarking)
 */
export function createCompetitorIntelAgent({ model, logger }: AgentDeps) {
	return new Agent({
		name: "competitive-intelligence",
		instructions: COMPETITOR_INTEL_PROMPT,
		model,
		tools: [competitorAnalysisTool],
		maxSteps: SUB_AGENT_MAX_STEPS,
		hooks: logger ? createLatencyHooks(logger) : undefined,
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
export function createExecCommsAgent({ model, logger }: AgentDeps) {
	return new Agent({
		name: "executive-communications",
		instructions: EXEC_COMMS_PROMPT,
		model,
		tools: [draftContentTool, generatePresentationTool],
		maxSteps: SUB_AGENT_MAX_STEPS,
		hooks: logger ? createLatencyHooks(logger) : undefined,
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
	logger,
	// Optional pre-built sub-agents. When provided, the supervisor
	// reuses these instances instead of creating its own. This lets
	// the host module hold a direct reference to (e.g.) the
	// executive-communications agent so the HTTP layer can dispatch
	// presentation requests directly to it without going through the
	// supervisor (the supervisor historically looped on
	// generate_daily_briefing when asked to make a deck).
	prebuiltSubAgents,
}: AgentDeps & {
	prebuiltSubAgents?: {
		marketIntel?: ReturnType<typeof createMarketIntelAgent>;
		regulatoryIntel?: ReturnType<typeof createRegulatoryIntelAgent>;
		competitorIntel?: ReturnType<typeof createCompetitorIntelAgent>;
		execComms?: ReturnType<typeof createExecCommsAgent>;
	};
}) {
	// First, create the specialist sub-agents. Each gets the same
	// logger so their latency traces land in the same Pino stream
	// as the supervisor's. Reuse any pre-built instance passed in.
	const marketIntel =
		prebuiltSubAgents?.marketIntel ?? createMarketIntelAgent({ model, logger });
	const regulatoryIntel =
		prebuiltSubAgents?.regulatoryIntel ??
		createRegulatoryIntelAgent({ model, logger });
	const competitorIntel =
		prebuiltSubAgents?.competitorIntel ??
		createCompetitorIntelAgent({ model, logger });
	const execComms =
		prebuiltSubAgents?.execComms ?? createExecCommsAgent({ model, logger });

	// Document tools are optional — only registered if a store was provided.
	// This keeps the agent constructable in unit tests without seeding a store.
	const documentTools = documentStore
		? [
				createDocumentUploadTool(documentStore),
				createDocumentRetrievalTool(documentStore),
			]
		: [];

	// Then create the supervisor that orchestrates them
	const supervisor = new Agent({
		name: "cso-intel-assistant",
		instructions: getSupervisorPrompt(agentName),
		model,
		memory,
		// Supervisor's own tools (in addition to its sub-agents).
		// Order matters: models default to whichever tool appears first
		// in the schema when the user request is ambiguous. RAG tools go
		// first because document-grounded answers are the most common
		// CSO request, and the briefing tool goes last because it is
		// almost never the right first move for a fresh, one-shot
		// request (and historically caused loops on pptx requests).
		tools: [
			...documentTools,
			riskIndicatorsTool,
			performanceMetricsTool,
			dailyBriefingTool,
		],
		// Sub-agents are registered here — VoltAgent automatically
		// exposes them as tools the supervisor can call
		subAgents: [marketIntel, regulatoryIntel, competitorIntel, execComms],
		maxSteps: SUPERVISOR_MAX_STEPS,
		hooks: logger ? createLatencyHooks(logger) : undefined,
	});

	// Expose the sub-agents and the supervisor on the returned object
	// so the host module (src/index.ts) can hand the executive-communications
	// instance to the Hono middleware that short-circuits presentation
	// requests. We return the supervisor as-is for compatibility with
	// existing callers; the extra fields are harmless.
	const enhanced = Object.assign(supervisor, {
		__subAgents: { marketIntel, regulatoryIntel, competitorIntel, execComms },
	}) as typeof supervisor & {
		__subAgents: {
			marketIntel: ReturnType<typeof createMarketIntelAgent>;
			regulatoryIntel: ReturnType<typeof createRegulatoryIntelAgent>;
			competitorIntel: ReturnType<typeof createCompetitorIntelAgent>;
			execComms: ReturnType<typeof createExecCommsAgent>;
		};
	};

	// ── Deck-intent short-circuit on streamText ─────────────────────
	// The supervisor (gpt-4o-mini) historically loops on
	// generate_daily_briefing when asked to make a deck. Prompt-level
	// fixes have not been reliable, so we wrap the supervisor's
	// streamText method to detect deck intent from the user input
	// and dispatch directly to the executive-communications sub-agent.
	// The supervisor is bypassed entirely for this one intent class.
	const DECK_INTENT_RE = /\b(presentation|deck|slides?|powerpoint|\.pptx)\b/i;
	const originalStreamText = supervisor.streamText.bind(
		supervisor,
	) as typeof supervisor.streamText;
	const wrappedStreamText = (async (
		input: Parameters<typeof supervisor.streamText>[0],
		options?: Parameters<typeof supervisor.streamText>[1],
	) => {
		// Extract a plain-text user input from the various shapes
		// streamText accepts (string, UIMessage[], ModelMessage[]).
		let text = "";
		if (typeof input === "string") {
			text = input;
		} else if (Array.isArray(input)) {
			for (const part of input) {
				if (typeof part === "string") {
					text += ` ${part}`;
				} else if (part && typeof part === "object") {
					const obj = part as Record<string, unknown>;
					if (typeof obj.text === "string") {
						text += ` ${obj.text}`;
					} else if (Array.isArray(obj.content)) {
						for (const c of obj.content) {
							if (c && typeof c === "object" && "text" in c) {
								text += ` ${String((c as { text: unknown }).text ?? "")}`;
							}
						}
					} else if (typeof obj.content === "string") {
						text += ` ${obj.content}`;
					}
				}
			}
		}
		if (DECK_INTENT_RE.test(text)) {
			// biome-ignore lint/suspicious/noConsole: routing decision is worth a visible log
			console.log(
				`[routing] Deck intent detected, dispatching to executive-communications sub-agent (inputPreview=${text.slice(0, 80)})`,
			);
			return execComms.streamText(
				input as Parameters<typeof execComms.streamText>[0],
				options as Parameters<typeof execComms.streamText>[1],
			);
		}
		return originalStreamText(input, options);
	}) as typeof supervisor.streamText;
	// biome-ignore lint/suspicious/noExplicitAny: streamText is a method, not a property; we assign via any to swap the binding
	(enhanced as any).streamText = wrappedStreamText;

	return enhanced;
}
