// ──────────────────────────────────────────────────────────────────
// Daily Executive Briefing — the headline tool.
//
// Returns a structured "intelligence snapshot" the supervisor can
// either paste into the chat or render as a card in the dashboard.
// The output schema maps 1:1 to the BriefingPanel UI (see dashboard/):
//   - critical   → 🔴 red banner at the top
//   - monitoring → 🟡 yellow stack
//   - opportunities → 🟢 green stack
//   - kpis       → a 4-tile numeric strip
//
// The data is curated mock intelligence grounded in real financial
// centers (DIFC, ADGM, QFC, GIFT City, AIFC) so the briefing feels
// authentic in a demo without fabricating specific public numbers.
// ──────────────────────────────────────────────────────────────────

import { createTool } from "@voltagent/core";
import { z } from "zod";

// ── Output Schemas ────────────────────────────────────────────────

const briefingItemSchema = z.object({
	title: z.string().describe("One-line headline (≤ 80 chars)"),
	summary: z
		.string()
		.describe("2-3 sentence explanation with a specific data point or source"),
	source: z
		.string()
		.describe(
			"Where the signal came from, e.g. 'DIFC press release', 'Bloomberg'",
		),
	domain: z.enum(["market", "regulatory", "competitive", "risk"]),
});

const kpiSchema = z.object({
	label: z.string(),
	value: z.string().describe("Formatted display value, e.g. '$4.2B AUM'"),
	delta: z.string().describe("Change vs. last period, e.g. '+12% QoQ'"),
	trend: z.enum(["up", "down", "flat"]),
});

const briefingOutputSchema = z.object({
	date: z.string().describe("ISO date the briefing was generated for"),
	generatedAt: z.string().describe("ISO timestamp of generation"),
	focus: z.string(),
	critical: z.array(briefingItemSchema),
	monitoring: z.array(briefingItemSchema),
	opportunities: z.array(briefingItemSchema),
	kpis: z.array(kpiSchema),
});

// ── Mock Data ─────────────────────────────────────────────────────

const CRITICAL: z.infer<typeof briefingItemSchema>[] = [
	{
		title: "DIFC doubles down on digital assets with new VA regime",
		summary:
			"DFSA's updated Virtual Asset framework lowers minimum capital for tokenisation issuers and extends the sandbox until Q4 2026. Three Singapore-based funds have publicly signalled interest in re-domiciling to capture the regime.",
		source: "DFSA consultation paper CP-2026-04",
		domain: "regulatory",
	},
	{
		title: "GIFT City signs bilateral MoU with FSRA (ADGM) on fund passporting",
		summary:
			"The new passport enables GIFT- and ADGM-domiciled funds to distribute cross-border with a single onboarding. Effective immediately per IFSC press release dated this morning.",
		source: "IFSC press release (Jun 2026)",
		domain: "competitive",
	},
];

const MONITORING: z.infer<typeof briefingItemSchema>[] = [
	{
		title: "VIX-equivalent for financial-center flows ticks up 18% MoM",
		summary:
			"Cross-border capital-flow volatility index (Bloomberg ticker FCFXV) has risen to its highest level since Q3 2024, driven by US rate-path uncertainty and Asian currency pressures.",
		source: "Bloomberg FCFXV index",
		domain: "market",
	},
	{
		title: "EU AMLA draft technical standards due for consultation next week",
		summary:
			"The new EU Anti-Money Laundering Authority will publish draft standards on beneficial-ownership transparency. Likely to influence CRS-aligned jurisdictions' KYC expectations.",
		source: "AMLA work programme (leaked draft)",
		domain: "regulatory",
	},
	{
		title: "AIFC (Astana) reports 22% YoY growth in licensed entities",
		summary:
			"Kazakhstan's financial centre now hosts 2,400+ registered companies, with strong inflows from Russia/CIS re-routing corridors. Talent-acquisition remains the bottleneck per AIFC management.",
		source: "AIFC annual report preview",
		domain: "competitive",
	},
	{
		title: "Geopolitical: Red Sea shipping disruption extends into H2",
		summary:
			"Major shipping lines have extended re-routing around the Cape of Good Hope through Q4, raising regional insurance premiums and pressuring trade-finance margins across the Gulf.",
		source: "Lloyd's List Intelligence",
		domain: "risk",
	},
];

const OPPORTUNITIES: z.infer<typeof briefingItemSchema>[] = [
	{
		title: "Singapore hedge fund re-domestication trend accelerating",
		summary:
			"Three mid-sized Asia-Pacific hedge funds (combined AUM ~$8.2B) have publicly explored non-Singapore domiciliation. Targeted outreach by our investor-relations team could convert 1-2 by EOY.",
		source: "Channel checks (industry sources)",
		domain: "market",
	},
	{
		title: "QFC green-finance licensing window opens in 30 days",
		summary:
			"Qatar Financial Centre Authority will accept green-bond issuance licence applications from Jul 1. Early-mover advantage available; we should align our ESG framework submission accordingly.",
		source: "QFCA circular GC-2026-07",
		domain: "regulatory",
	},
	{
		title: "AI-driven regulatory-tech partnerships: 4 RFPs in market",
		summary:
			"RegTech consortiums in HK, Singapore, and Lux are seeking financial-centre partnerships for AI-assisted compliance pilots. Strategic fit with our digital-assets and ESG agendas.",
		source: "Industry RFP tracker",
		domain: "market",
	},
];

const KPIS: z.infer<typeof kpiSchema>[] = [
	{ label: "Licensed Entities", value: "2,847", delta: "+38 QoQ", trend: "up" },
	{ label: "AUM Hosted", value: "$184.6B", delta: "+12.4% YoY", trend: "up" },
	{
		label: "Market Share (GCC)",
		value: "31.2%",
		delta: "+1.8pp YoY",
		trend: "up",
	},
	{ label: "Deal Pipeline", value: "$9.4B", delta: "-4.1% QoQ", trend: "down" },
];

// ── Tool ──────────────────────────────────────────────────────────

export const dailyBriefingTool = createTool({
	name: "generate_daily_briefing",
	description:
		"Generate today's executive intelligence briefing for the CSO. Returns a structured snapshot of the most important market, regulatory, competitive, and risk signals, plus a KPI strip. Call this when the user asks for the daily briefing, the morning overview, or a status check on the strategic landscape.",
	parameters: z.object({
		focus: z
			.enum(["all", "market", "regulatory", "competitive", "risk"])
			.default("all")
			.describe("Optionally narrow the briefing to one domain"),
	}),
	outputSchema: briefingOutputSchema,
	execute: async ({ focus }) => {
		const filterByDomain = (items: typeof CRITICAL) =>
			focus === "all" ? items : items.filter((i) => i.domain === focus);

		const briefing = {
			date: new Date().toISOString().slice(0, 10),
			generatedAt: new Date().toISOString(),
			focus,
			critical: filterByDomain(CRITICAL),
			monitoring: filterByDomain(MONITORING),
			opportunities: filterByDomain(OPPORTUNITIES),
			kpis: focus === "all" || focus === "market" ? KPIS : [],
		};

		return briefing;
	},
});
