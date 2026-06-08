// ──────────────────────────────────────────────────────────────────
// Tools — Re-exports
//
// Each tool is a `createTool()` instance the LLM can decide to call
// based on the user's question. The shape of the tool's
// `description` field is the most important prompt you write —
// it's what the model reads to decide when to invoke the tool.
//
// Assignment to agents (Phase 2/3 wiring in src/agents/agents.ts):
//   - dailyBriefingTool          → supervisor
//   - riskIndicatorsTool         → supervisor
//   - performanceMetricsTool     → supervisor
//   - documentUploadTool         → supervisor (PDF / DOCX / TXT / MD)
//   - documentRetrievalTool      → supervisor (RAG over uploaded docs)
//   - marketIntelligenceTool     → market-intel sub-agent
//   - competitorAnalysisTool     → competitor-intel sub-agent
//   - regulatoryTrackerTool      → regulatory-intel sub-agent
//   - draftContentTool           → exec-comms sub-agent
//
// The two document tools are FACTORIES (createDocumentUploadTool /
// createDocumentRetrievalTool) — they need a live DocumentStore, which
// is constructed in src/index.ts and passed in. We re-export the
// factory functions and the DocumentStore type here for convenience.
// ──────────────────────────────────────────────────────────────────

export { dailyBriefingTool } from "./daily-briefing.js";
export { marketIntelligenceTool } from "./market-intelligence.js";
export { competitorAnalysisTool } from "./competitor-analysis.js";
export { regulatoryTrackerTool } from "./regulatory-tracker.js";
export { riskIndicatorsTool } from "./risk-indicators.js";
export { performanceMetricsTool } from "./performance-metrics.js";
export { draftContentTool } from "./draft-content.js";
export { createDocumentUploadTool } from "./document-upload.js";
export { createDocumentRetrievalTool } from "./document-retrieval.js";
