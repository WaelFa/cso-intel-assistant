// ──────────────────────────────────────────────────────────────────
// Competitive Intelligence Tool — benchmarks the user-selected
// financial centre against ours across a chosen dimension
// (regulatory, talent, tax, infrastructure, or all).
//
// Returns a SWOT-shaped structured output the supervisor agent can
// narrate, plus a benchmark delta and concrete response options.
// ──────────────────────────────────────────────────────────────────

import { createTool } from "@voltagent/core";
import { z } from "zod";

// ── Output Schema ─────────────────────────────────────────────────

const benchmarkScoreSchema = z.object({
	ours: z.string().describe("Our position, e.g. '8.5/10' or '0% corp tax'"),
	them: z.string().describe("Their position"),
	delta: z
		.string()
		.describe("Direction + gap, e.g. '+1.5 ahead' or '-2 behind'"),
});

const competitorOutputSchema = z.object({
	competitor: z.string().describe("Financial centre name"),
	dimension: z.string(),
	strategicIntent: z
		.string()
		.describe("What the competitor is trying to achieve"),
	threatLevel: z.enum(["direct", "indirect", "none"]),
	swot: z.object({
		strengths: z
			.array(z.string())
			.describe("Their strengths in this dimension"),
		weaknesses: z.array(z.string()).describe("Their weaknesses"),
		opportunities: z.array(z.string()).describe("Opportunities for us"),
		threats: z.array(z.string()).describe("Threats they pose"),
	}),
	benchmark: benchmarkScoreSchema,
	responseOptions: z
		.array(z.string())
		.describe("Concrete actions we could take in the next 90 days"),
	note: z.string().describe("Demo-data disclaimer"),
});

// ── Curated Mock Profiles (centre × dimension) ────────────────────

interface CompetitorProfile {
	strategicIntent: string;
	threatLevel: "direct" | "indirect" | "none";
	swot: {
		strengths: string[];
		weaknesses: string[];
		opportunities: string[];
		threats: string[];
	};
	benchmark: { ours: string; them: string; delta: string };
	responseOptions: string[];
}

const PROFILES: Record<string, Record<string, CompetitorProfile>> = {
	DIFC: {
		regulatory: {
			strategicIntent:
				"Position DIFC as the dominant MENA hub for digital assets, fund management, and family offices via the DFSA's permissive VA regime and 0% tax regime.",
			threatLevel: "direct",
			swot: {
				strengths: [
					"Mature common-law framework (DFSA + DIFC Courts)",
					"0% corporate tax for 50 years (now extended to 2049)",
					"Established brand with 6,000+ active firms",
				],
				weaknesses: [
					"Real-estate cost burden for mid-sized firms",
					"Geopolitical concentration risk in a single jurisdiction",
				],
				opportunities: [
					"Co-marketing campaigns to UK/EU funds post-Mifid II review",
					"Joint sandbox with MAS for tokenised RWAs",
				],
				threats: [
					"Could absorb our fund-domiciliation pipeline if we delay on tax clarity",
					"Strong relationships with sovereign-wealth allocators",
				],
			},
			benchmark: { ours: "Strong", them: "Stronger", delta: "-1 tier" },
			responseOptions: [
				"Publish our 10-year tax-assurance commitment within 30 days",
				"Open DIFC co-working office to maintain presence without relocation cost",
				"Co-host a digital-assets roundtable with DFSA leadership",
			],
		},
		talent: {
			strategicIntent:
				"Attract senior financial-services talent with golden-visa and lifestyle package.",
			threatLevel: "direct",
			swot: {
				strengths: [
					"Established expat communities (British, Indian, Lebanese)",
					"Golden-visa pathways well-trodden",
					"Proximity to Dubai's lifestyle amenities",
				],
				weaknesses: [
					"Rising cost of living eroding net compensation",
					"Limited local university pipeline for specialist roles",
				],
				opportunities: [
					"Differentiate on education/schooling packages for relocating families",
					"Partner with regional universities on fintech curricula",
				],
				threats: ["Senior hires being poached for DIFC partner-track roles"],
			},
			benchmark: { ours: "Good", them: "Excellent", delta: "-1 tier" },
			responseOptions: [
				"Launch a 'CSO Fellow' 12-month rotation for high-potential staff",
				"Subsidise executive education at INSEAD/LBS for retention",
			],
		},
	},
	"GIFT City": {
		regulatory: {
			strategicIntent:
				"Capture captive offshore business from India-sourced FPIs, insurance, and fund management via IFSC's tax-efficient sandbox.",
			threatLevel: "direct",
			swot: {
				strengths: [
					"Direct access to Indian rupee and Indian-domiciled investors",
					"100% tax holiday extended to 2030",
					"GIFT-IFSC regulator IFSCA is agile and market-responsive",
				],
				weaknesses: [
					"Limited secondary-market liquidity",
					"Dependence on Indian macro stability",
				],
				opportunities: [
					"Co-distribute India-domiciled wealth via our international channel",
					"Set up a GIFT City representative office for India-sourced deal flow",
				],
				threats: [
					"IFSCA is signing MoUs with peer regulators faster than we are",
				],
			},
			benchmark: {
				ours: "Adequate",
				them: "Stronger on India corridor",
				delta: "-1 tier",
			},
			responseOptions: [
				"Open India-corridor representative office in Mumbai or GIFT City",
				"Co-host an IFSCA-our-authority regulatory dialogue in Q3",
			],
		},
		infrastructure: {
			strategicIntent:
				"Build world-class digital and physical infrastructure (smart-city grade) to leapfrog legacy financial centres.",
			threatLevel: "indirect",
			swot: {
				strengths: [
					"Greenfield smart-city grade infrastructure",
					"Dedicated undersea-cable connectivity",
				],
				weaknesses: [
					"Travel-access friction vs. Gulf hubs",
					"Time-zone mismatch with London/NY closes",
				],
				opportunities: [
					"Position ourselves as a 24-hour follow-the-sun coverage partner",
					"Market our existing infrastructure maturity as a low-risk choice",
				],
				threats: [
					"Could attract cloud/AI-infrastructure providers away from us",
				],
			},
			benchmark: {
				ours: "Mature",
				them: "Newer but high-quality",
				delta: "+0.5 tier",
			},
			responseOptions: [
				"Publish infrastructure uptime SLAs and case studies",
				"Bundle managed-cloud services with licensing packages",
			],
		},
	},
	ADGM: {
		regulatory: {
			strategicIntent:
				"Leverage FSRA's strong FinTech and sustainable-finance mandates to capture Abu Dhabi sovereign capital flows.",
			threatLevel: "indirect",
			swot: {
				strengths: [
					"FSRA FinTech regulatory lab is best-in-class",
					"Abu Dhabi sovereign capital available for co-investment",
				],
				weaknesses: [
					"Smaller ecosystem than DIFC",
					"Less developed court-enforcement track record",
				],
				opportunities: [
					"Joint FinTech-lab participation",
					"Sustainable-finance co-issuance with ADGM",
				],
				threats: ["Co-opetition: ADGM is also a partner in some deals"],
			},
			benchmark: {
				ours: "Strong",
				them: "Strong on FinTech",
				delta: "0 / specialised",
			},
			responseOptions: [
				"Propose a quarterly FinTech-lab knowledge exchange",
				"Pursue joint sustainable-finance framework with ADGM/FSRA",
			],
		},
	},
	QFC: {
		regulatory: {
			strategicIntent:
				"Use Qatar's hydrocarbon wealth to fund a permissive QFCA regulatory framework for green and Islamic finance.",
			threatLevel: "indirect",
			swot: {
				strengths: [
					"Strong sovereign backing",
					"QFC/QCAA common-law framework",
				],
				weaknesses: [
					"Smaller talent pool than Gulf peers",
					"Less-developed international brand",
				],
				opportunities: [
					"Co-marketing green-finance products with QFCA",
					"Qatar-Asia wealth corridor initiatives",
				],
				threats: ["Could undercut on fees for Islamic-finance business"],
			},
			benchmark: {
				ours: "Strong",
				them: "Specialised (Islamic/green)",
				delta: "0 / specialised",
			},
			responseOptions: [
				"Open QFC liaison office to capture Qatari institutional flows",
				"Joint Islamic-finance product launches",
			],
		},
	},
};

const DEFAULT_PROFILE: CompetitorProfile = {
	strategicIntent:
		"Competitor strategic intent not catalogued in demo data. In production this would be researched via live web search and industry reports.",
	threatLevel: "indirect",
	swot: {
		strengths: ["Established market presence", "Regulatory stability"],
		weaknesses: ["Cost structures not detailed in demo data"],
		opportunities: ["Untapped segments for collaboration"],
		threats: ["Generic competitive pressure"],
	},
	benchmark: { ours: "—", them: "—", delta: "—" },
	responseOptions: [
		"Schedule a structured competitor briefing for the CSO",
		"Commission an industry-analyst deep-dive",
	],
};

// ── Tool ──────────────────────────────────────────────────────────

export const competitorAnalysisTool = createTool({
	name: "analyze_competitor",
	description:
		"Benchmark a specific competitor financial centre (e.g. 'DIFC', 'ADGM', 'QFC', 'GIFT City', 'AIFC', 'NIFC', 'Singapore', 'Hong Kong', 'Luxembourg', 'Ireland') against our position across a chosen dimension (regulatory, talent, tax, infrastructure, ecosystem). Returns a SWOT-shaped analysis with threat level, benchmark delta, and concrete 90-day response options. Use this whenever the user asks 'how do we compare to X' or 'what is Y doing'.",
	parameters: z.object({
		financialCenter: z
			.string()
			.describe(
				"Name of the competitor financial centre, e.g. 'DIFC', 'GIFT City'",
			),
		dimension: z
			.enum([
				"regulatory",
				"talent",
				"tax",
				"infrastructure",
				"ecosystem",
				"all",
			])
			.default("all")
			.describe("Dimension to benchmark on"),
	}),
	outputSchema: competitorOutputSchema,
	execute: async ({ financialCenter, dimension }) => {
		const center = financialCenter.toUpperCase();
		const centerProfiles = PROFILES[center];
		const profile =
			centerProfiles?.[dimension] ??
			(dimension === "all" && centerProfiles
				? Object.values(centerProfiles)[0]
				: DEFAULT_PROFILE);

		return {
			competitor: financialCenter,
			dimension,
			strategicIntent: profile.strategicIntent,
			threatLevel: profile.threatLevel,
			swot: profile.swot,
			benchmark: profile.benchmark,
			responseOptions: profile.responseOptions,
			note: "This is demo-grade curated data. Production deployment will pull from live regulatory feeds, industry reports, and proprietary channel checks.",
		};
	},
});
