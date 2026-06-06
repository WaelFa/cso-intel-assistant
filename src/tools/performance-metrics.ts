// ──────────────────────────────────────────────────────────────────
// Performance Metrics Tool — returns the financial centre's
// organisational KPIs: initiative progress, strategic-objective
// health, team metrics. Designed to render as a chart/card in the
// dashboard (Phase 4) and as a narrative in chat.
//
// P2 in the priority order, but the supervisor's system prompt
// already references it as an available tool, so we build it to
// keep the LLM's mental model honest.
// ──────────────────────────────────────────────────────────────────

import { createTool } from "@voltagent/core";
import { z } from "zod";

// ── Output Schema ─────────────────────────────────────────────────

const kpiSchema = z.object({
	name: z.string(),
	category: z.enum(["growth", "client", "operational", "talent", "risk"]),
	value: z.string().describe("Formatted display value, e.g. '$4.2B', '87%'"),
	target: z.string().describe("Period target, e.g. '$5.0B', '90%'"),
	status: z.enum(["on_track", "at_risk", "off_track"]),
	trend: z.enum(["up", "down", "flat"]),
	commentary: z
		.string()
		.describe("1-sentence narrative explaining the latest move"),
});

const performanceOutputSchema = z.object({
	period: z.string().describe("Reporting period, e.g. 'Q2 2026'"),
	generatedAt: z.string(),
	kpis: z.array(kpiSchema),
	initiativeProgress: z.array(
		z.object({
			name: z.string(),
			sponsor: z.string().describe("Executive sponsor"),
			progress: z.number().min(0).max(100).describe("Percent complete"),
			status: z.enum(["on_track", "at_risk", "off_track", "complete"]),
			nextMilestone: z.string(),
		}),
	),
	note: z.string(),
});

// ── Mock Performance Data ─────────────────────────────────────────

const KPIS: z.infer<typeof kpiSchema>[] = [
	{
		name: "AUM Hosted",
		category: "growth",
		value: "$184.6B",
		target: "$200B",
		status: "on_track",
		trend: "up",
		commentary:
			"Q2 net inflows of $5.2B; three re-domiciliations from Singapore in flight.",
	},
	{
		name: "New Licensed Entities (QoQ)",
		category: "growth",
		value: "38",
		target: "40",
		status: "on_track",
		trend: "up",
		commentary: "On pace for Q2 target; FinTech cohort accounts for 22 of 38.",
	},
	{
		name: "GCC Market Share",
		category: "growth",
		value: "31.2%",
		target: "32.0%",
		status: "at_risk",
		trend: "up",
		commentary:
			"Trended up 1.8pp YoY but Q2 flat as DIFC closed large fund mandate.",
	},
	{
		name: "NPS (Institutional Clients)",
		category: "client",
		value: "62",
		target: "65",
		status: "at_risk",
		trend: "flat",
		commentary:
			"Stable but below target; 'onboarding speed' cited as the primary detractor.",
	},
	{
		name: "Time-to-Onboard (median days)",
		category: "operational",
		value: "18",
		target: "12",
		status: "off_track",
		trend: "down",
		commentary:
			"Off target; AML/KYC rework is the bottleneck. Operations improvement programme in flight.",
	},
	{
		name: "Voluntary Attrition (Senior RMs)",
		category: "talent",
		value: "9.4%",
		target: "6.0%",
		status: "off_track",
		trend: "up",
		commentary: "Trended up 1.8pp YoY; 3 of 4 exits cited DIFC opportunities.",
	},
	{
		name: "Critical-Incident Count (90d)",
		category: "risk",
		value: "0",
		target: "0",
		status: "on_track",
		trend: "flat",
		commentary: "No P1 incidents; SOC2 audit on track for Q3.",
	},
];

const INITIATIVES: {
	name: string;
	sponsor: string;
	progress: number;
	status: "on_track" | "at_risk" | "off_track" | "complete";
	nextMilestone: string;
}[] = [
	{
		name: "Digital-Assets Framework v2",
		sponsor: "Head of Regulatory",
		progress: 68,
		status: "on_track",
		nextMilestone: "Public consultation opens Jul 15",
	},
	{
		name: "Onboarding Speed Programme (18d → 12d)",
		sponsor: "COO",
		progress: 35,
		status: "at_risk",
		nextMilestone: "Phase-1 KYC automation go-live (Aug 1)",
	},
	{
		name: "Asia-Pacific Investor Roadshow",
		sponsor: "Head of BD",
		progress: 50,
		status: "on_track",
		nextMilestone: "Singapore stop (Jul 22-24)",
	},
	{
		name: "Sustainable-Finance Co-issuance Pilot",
		sponsor: "Head of Funds",
		progress: 22,
		status: "at_risk",
		nextMilestone: "Counterparty selection by Jul 31",
	},
	{
		name: "Talent Retention Package (Senior RM)",
		sponsor: "CHRO",
		progress: 80,
		status: "on_track",
		nextMilestone: "Board sign-off (Jun 30)",
	},
];

// ── Tool ──────────────────────────────────────────────────────────

export const performanceMetricsTool = createTool({
	name: "get_performance_metrics",
	description:
		"Return organisational performance metrics for the financial centre: KPIs across growth, client, operational, talent, and risk categories, plus initiative progress for the CSO's strategic agenda. Each KPI includes its target, status (on_track / at_risk / off_track), and a 1-sentence commentary. Use this whenever the user asks 'how are we doing', 'KPI update', 'initiative status', or 'quarterly review'.",
	parameters: z.object({
		period: z
			.string()
			.default("current")
			.describe(
				"Reporting period, e.g. 'Q2 2026', 'YTD', 'last 30 days', or 'current'",
			),
	}),
	outputSchema: performanceOutputSchema,
	execute: async ({ period }) => {
		return {
			period: period === "current" ? "Q2 2026 (current)" : period,
			generatedAt: new Date().toISOString(),
			kpis: KPIS,
			initiativeProgress: INITIATIVES,
			note: "Demo-grade data. Production deployment will pull from the corporate performance dashboard (Workday/Adaptive) and the strategic-portfolio management system.",
		};
	},
});
