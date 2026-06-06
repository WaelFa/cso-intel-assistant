// ──────────────────────────────────────────────────────────────────
// Risk Indicators Tool — aggregates risk signals across market,
// regulatory, competitive, operational, and geopolitical categories.
//
// Closes the gap from the assessment PDF: it explicitly listed
// "Risk Indicators" as one of the six daily intelligence areas
// (overnight, market, competitor, regulatory, performance, **risk**),
// but the original plan mapped only the other five. This tool
// gives the CSO a single call to ask "what should I be worried
// about today?"
// ──────────────────────────────────────────────────────────────────

import { createTool } from "@voltagent/core";
import { z } from "zod";

// ── Output Schema ─────────────────────────────────────────────────

const riskIndicatorSchema = z.object({
	indicator: z.string().describe("Name of the indicator"),
	category: z.enum([
		"market",
		"regulatory",
		"competitive",
		"operational",
		"geopolitical",
	]),
	level: z.enum(["critical", "elevated", "nominal"]),
	contributingFactors: z
		.array(z.string())
		.describe("What's driving the signal"),
	dataPoint: z.string().describe("The most recent measurable data point"),
	recommendedMonitoring: z
		.string()
		.describe("Action we should take in the next 7 days"),
	source: z.string(),
});

const riskOutputSchema = z.object({
	category: z.string().describe("Category filter (or 'all')"),
	timeframe: z.string(),
	overallLevel: z.enum(["critical", "elevated", "nominal"]),
	indicators: z.array(riskIndicatorSchema),
	summary: z
		.string()
		.describe("One-paragraph executive summary of the risk landscape"),
	note: z.string(),
});

// ── Mock Risk Library ─────────────────────────────────────────────

const RISK_LIBRARY: z.infer<typeof riskIndicatorSchema>[] = [
	{
		indicator: "Cross-border capital-flow volatility (FCFXV index)",
		category: "market",
		level: "elevated",
		contributingFactors: [
			"US rate-path uncertainty",
			"Asian currency pressure (JPY, CNY)",
			"Late-stage credit-cycle positioning",
		],
		dataPoint: "FCFXV +18% MoM, highest since Q3 2024",
		recommendedMonitoring:
			"Weekly capital-flow briefing; flag any >25% MoM moves to the CSO; review hedging overlay on flagship funds.",
		source: "Bloomberg FCFXV index",
	},
	{
		indicator: "Digital-asset regulatory regime divergence",
		category: "regulatory",
		level: "critical",
		contributingFactors: [
			"DFSA tokenisation capital-relief (just enacted)",
			"ESMA MiCA RTS final standards in review",
			"AMLA beneficial-ownership standards pending",
		],
		dataPoint:
			"3 major regulatory shifts in last 30 days across DIFC, EU, and GIFT City",
		recommendedMonitoring:
			"Convene a 1-hour war-room with the regulatory lead within 14 days; align our sandbox offer against the new DFSA capital thresholds.",
		source: "Cross-reference: track_regulatory_changes tool output",
	},
	{
		indicator: "GCC competitive intensity in fund domiciliation",
		category: "competitive",
		level: "elevated",
		contributingFactors: [
			"DIFC and GIFT City both announcing 30-day review windows",
			"ADGM strengthening FinTech-lab pipeline",
		],
		dataPoint:
			"Our fund-domiciliation pipeline down 4% QoQ; competitor fund-domiciliation volume up 12% QoQ",
		recommendedMonitoring:
			"Re-baseline our value proposition against Pillar Two; brief investor-relations on messaging updates.",
		source: "Internal pipeline data + competitor press releases",
	},
	{
		indicator: "Red Sea / Hormuz shipping disruption",
		category: "geopolitical",
		level: "elevated",
		contributingFactors: [
			"Lloyd's List reports H2 2026 re-routing confirmed",
			"Insurance premiums up ~22% on Gulf-origin cargo",
		],
		dataPoint:
			"Trade-finance margins compressed by ~35bps across Gulf corridors",
		recommendedMonitoring:
			"Engage with the trade-finance product lead on revised pricing; brief credit committee on sector exposure.",
		source: "Lloyd's List Intelligence, Q2 2026",
	},
	{
		indicator: "Talent attrition — senior relationship managers",
		category: "operational",
		level: "elevated",
		contributingFactors: [
			"DIFC partner-track opportunities cited in 3 of 4 recent exits",
			"Cost-of-living compression on net comp",
		],
		dataPoint: "Voluntary attrition up 1.8pp YoY in senior RM band",
		recommendedMonitoring:
			"Launch retention review with CHRO; approve 'CSO Fellow' rotation proposal; review senior comp band vs. DIFC.",
		source: "HR attrition dashboard Q2 2026",
	},
	{
		indicator: "Cybersecurity / RegTech adoption",
		category: "operational",
		level: "nominal",
		contributingFactors: [
			"All critical systems on track for Q3 SOC2 audit",
			"No major incidents reported in last 90 days",
		],
		dataPoint: "0 P1 incidents; mean-time-to-detect: 11 min",
		recommendedMonitoring:
			"Maintain current posture; no action required this week.",
		source: "Security operations dashboard",
	},
];

// ── Helpers ───────────────────────────────────────────────────────

const LEVEL_RANK = { nominal: 0, elevated: 1, critical: 2 } as const;
type Level = keyof typeof LEVEL_RANK;

function maxLevel(indicators: z.infer<typeof riskIndicatorSchema>[]): Level {
	if (indicators.some((i) => i.level === "critical")) return "critical";
	if (indicators.some((i) => i.level === "elevated")) return "elevated";
	return "nominal";
}

function buildSummary(
	overall: Level,
	indicators: z.infer<typeof riskIndicatorSchema>[],
): string {
	const counts = {
		critical: indicators.filter((i) => i.level === "critical").length,
		elevated: indicators.filter((i) => i.level === "elevated").length,
		nominal: indicators.filter((i) => i.level === "nominal").length,
	};
	const headline =
		overall === "critical"
			? "Risk posture is CRITICAL — at least one indicator requires immediate executive attention."
			: overall === "elevated"
				? "Risk posture is ELEVATED — multiple indicators warrant active monitoring this week."
				: "Risk posture is NOMINAL — no immediate action required.";
	return `${headline} (🔴 ${counts.critical} critical · 🟡 ${counts.elevated} elevated · 🟢 ${counts.nominal} nominal)`;
}

// ── Tool ──────────────────────────────────────────────────────────

export const riskIndicatorsTool = createTool({
	name: "get_risk_indicators",
	description:
		"Get the current risk indicator dashboard across market, regulatory, competitive, operational, and geopolitical categories. Returns an overall risk level (🔴 critical / 🟡 elevated / 🟢 nominal), per-indicator contributing factors, the latest data point, and recommended monitoring actions for the next 7 days. Use this whenever the user asks 'what should I be worried about', 'any risks today', or requests the risk dashboard.",
	parameters: z.object({
		category: z
			.enum([
				"all",
				"market",
				"regulatory",
				"competitive",
				"operational",
				"geopolitical",
			])
			.default("all")
			.describe("Risk category to focus on"),
		timeframe: z
			.enum(["24h", "7d", "30d"])
			.default("7d")
			.describe("Lookback window for the risk signals"),
	}),
	outputSchema: riskOutputSchema,
	execute: async ({ category, timeframe }) => {
		const indicators =
			category === "all"
				? RISK_LIBRARY
				: RISK_LIBRARY.filter((i) => i.category === category);

		return {
			category,
			timeframe,
			overallLevel: maxLevel(indicators),
			indicators,
			summary: buildSummary(maxLevel(indicators), indicators),
			note: "Demo-grade risk intelligence. Production deployment will pull from live volatility indices, sanctions lists, central-bank alerts, and proprietary operational dashboards.",
		};
	},
});

// Internal helper kept for the level-rank computation referenced above.
export const _LEVEL_RANK = LEVEL_RANK;
