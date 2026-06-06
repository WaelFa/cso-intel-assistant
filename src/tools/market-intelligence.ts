// ──────────────────────────────────────────────────────────────────
// Market Intelligence Tool — capital flows, investor sentiment,
// sector trends, FDI signals.
//
// The market-intelligence sub-agent uses this tool to "research" a
// topic. In production this would call Brave Search / Tavily via MCP;
// for Phase 2 it returns curated mock data grounded in real-world
// financial-centre dynamics. The shape of the output is what matters:
// the supervisor will narrate it into an executive-friendly response.
//
// To wire a real provider later, replace the body of `execute` with a
// `fetch` call to Brave/Tavily and map the response to the same
// `MarketIntelOutput` shape — nothing else needs to change.
// ──────────────────────────────────────────────────────────────────

import { createTool } from "@voltagent/core";
import { z } from "zod";

// ── Output Schema ─────────────────────────────────────────────────

const marketSignalSchema = z.object({
	headline: z.string().describe("One-line signal"),
	detail: z.string().describe("2-3 sentences of supporting context"),
	magnitude: z.enum(["high", "medium", "low"]),
	region: z.string().describe("Geographic region, e.g. 'Gulf', 'Asia-Pacific'"),
});

const marketOutputSchema = z.object({
	topic: z.string(),
	region: z.string().nullable(),
	timeframe: z.string(),
	trend: z.enum(["growing", "stable", "declining"]),
	signals: z.array(marketSignalSchema),
	sources: z.array(z.string()),
	note: z
		.string()
		.describe(
			"Demo-data disclaimer so the LLM doesn't treat mock data as live",
		),
});

// ── Curated Mock Signals (topic-keyed) ────────────────────────────

const MOCK_BY_TOPIC: Record<string, z.infer<typeof marketSignalSchema>[]> = {
	"digital assets": [
		{
			headline: "Tokenised money-market funds now exceed $12B AUM globally",
			detail:
				"BlackRock's BUIDL and Franklin Templeton's FOBXX have driven most of the growth; Asia-Pacific issuance is accelerating from a small base.",
			magnitude: "high",
			region: "Global",
		},
		{
			headline: "Institutional desks adding 24/7 settlement desks",
			detail:
				"Three Tier-1 banks have opened digital-asset settlement desks in the past quarter, citing client demand for instant cross-border payments.",
			magnitude: "medium",
			region: "Global",
		},
	],
	"fund domiciliation": [
		{
			headline: "Mid-sized hedge funds exploring non-Singapore domiciles",
			detail:
				"Industry sources report 3 Asia-Pac funds (combined ~$8.2B AUM) actively evaluating GIFT City, DIFC, and Luxembourg for cost and tax treatment.",
			magnitude: "high",
			region: "Asia-Pacific",
		},
		{
			headline: "Luxembourg RAIF adoption up 18% YoY",
			detail:
				"Reserved Alternative Investment Fund vehicle remains the fastest-growing European structure for cross-border distribution.",
			magnitude: "medium",
			region: "EMEA",
		},
	],
	fdi: [
		{
			headline: "Gulf FDI inflows rebounding after 2024 trough",
			detail:
				"UNCTAD data shows GCC FDI inflows up 9% YoY in Q1 2026, led by India- and Singapore-sourced greenfield investment in financial services.",
			magnitude: "medium",
			region: "Gulf",
		},
	],
	fintech: [
		{
			headline: "Embedded finance M&A volume up 40% YoY",
			detail:
				"Strategic acquirers are paying 6-8x revenue for established embedded-finance platforms, with Middle East and Africa the most active regions.",
			magnitude: "medium",
			region: "Global",
		},
	],
};

const DEFAULT_SIGNALS: z.infer<typeof marketSignalSchema>[] = [
	{
		headline: "Cross-border capital flows stable QoQ",
		detail:
			"Aggregate capital flow indicators across major financial centres remain within historical norms; no significant dislocation detected.",
		magnitude: "low",
		region: "Global",
	},
	{
		headline: "Sector rotation: defensives into AI/tech exposure",
		detail:
			"Allocator surveys indicate a 4-6% reallocation from defensives into AI-infrastructure and cybersecurity exposure across institutional mandates.",
		magnitude: "medium",
		region: "Global",
	},
];

// ── Helpers ───────────────────────────────────────────────────────

function pickSignals(topic: string): z.infer<typeof marketSignalSchema>[] {
	const key = topic.toLowerCase();
	for (const [k, v] of Object.entries(MOCK_BY_TOPIC)) {
		if (key.includes(k)) return v;
	}
	return DEFAULT_SIGNALS;
}

function inferTrend(
	signals: z.infer<typeof marketSignalSchema>[],
): "growing" | "stable" | "declining" {
	const highCount = signals.filter((s) => s.magnitude === "high").length;
	if (highCount >= 1) return "growing";
	return "stable";
}

// ── Tool ──────────────────────────────────────────────────────────

export const marketIntelligenceTool = createTool({
	name: "search_market_intelligence",
	description:
		"Search for market intelligence on a topic (e.g. 'digital assets', 'fund domiciliation', 'FDI flows', 'fintech M&A'). Optionally narrow by region and timeframe. Returns structured signals with magnitude, region, and an inferred trend direction. Use this whenever the user asks about market conditions, capital flows, investor sentiment, or sector trends.",
	parameters: z.object({
		topic: z
			.string()
			.describe(
				"The subject to research, e.g. 'digital assets', 'fund domiciliation trends'",
			),
		region: z
			.string()
			.nullable()
			.default(null)
			.describe("Optional region filter, e.g. 'Gulf', 'Asia-Pacific', 'EMEA'"),
		timeframe: z
			.enum(["24h", "7d", "30d", "90d", "ytd"])
			.default("30d")
			.describe("How far back to look"),
	}),
	outputSchema: marketOutputSchema,
	execute: async ({ topic, region, timeframe }) => {
		const signals = pickSignals(topic);
		return {
			topic,
			region,
			timeframe,
			trend: inferTrend(signals),
			signals: region
				? signals.filter(
						(s) =>
							s.region.toLowerCase() === region.toLowerCase() ||
							s.region.toLowerCase() === "global",
					)
				: signals,
			sources: [
				"Bloomberg Intelligence (curated)",
				"UNCTAD World Investment Report",
				"Industry channel checks",
			],
			note:
				"This is demo-grade curated data for prototype purposes. " +
				"Production deployment will route this through Brave/Tavily live search.",
		};
	},
});
