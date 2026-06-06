// ──────────────────────────────────────────────────────────────────
// Regulatory Tracker Tool — surfaces recent and pending regulatory
// changes in a given jurisdiction × sector, optionally filtered by
// severity. Used by the regulatory-intelligence sub-agent.
//
// The output is structured for both the chat narrative and a future
// "regulatory radar" dashboard widget.
// ──────────────────────────────────────────────────────────────────

import { createTool } from "@voltagent/core";
import { z } from "zod";

// ── Output Schema ─────────────────────────────────────────────────

const regulatoryChangeSchema = z.object({
	title: z.string(),
	jurisdiction: z.string(),
	sector: z.string(),
	status: z.enum(["proposed", "under_review", "enacted", "amended"]),
	severity: z.enum(["high", "medium", "low"]),
	effectiveDate: z.string().nullable().describe("ISO date if known"),
	summary: z.string().describe("2-3 sentence plain-English summary"),
	impact: z.string().describe("What this means for our financial centre"),
	actionRequired: z.string().describe("What we should do"),
	source: z.string(),
});

const regulatoryOutputSchema = z.object({
	jurisdiction: z.string(),
	sector: z.string(),
	severity: z.string(),
	changes: z.array(regulatoryChangeSchema),
	count: z.number(),
	note: z.string(),
});

// ── Curated Mock Changes ──────────────────────────────────────────

const CHANGES: z.infer<typeof regulatoryChangeSchema>[] = [
	{
		title: "DFSA Virtual Asset Framework — Capital Reduction",
		jurisdiction: "UAE (DIFC)",
		sector: "digital_assets",
		status: "enacted",
		severity: "high",
		effectiveDate: "2026-07-01",
		summary:
			"DFSA has finalised a 40% reduction in minimum capital requirements for tokenisation issuers, alongside an extension of the regulatory sandbox to Q4 2026.",
		impact:
			"Strengthens DIFC's digital-asset positioning; could divert our sandbox pipeline if not matched by us within 6 months.",
		actionRequired:
			"Review our VA framework consultation timeline; consider accelerating our own capital-relief proposals.",
		source: "DFSA CP-2026-04 final",
	},
	{
		title: "AMLA Draft Technical Standards — Beneficial Ownership",
		jurisdiction: "EU",
		sector: "aml_kyc",
		status: "proposed",
		severity: "high",
		effectiveDate: null,
		summary:
			"EU Anti-Money Laundering Authority will publish draft technical standards on beneficial-ownership transparency; consultation opens next week.",
		impact:
			"Likely to influence CRS-aligned jurisdictions' KYC expectations; our onboarding flow may need re-tooling for new BO data fields.",
		actionRequired:
			"Brief our compliance lead; pre-draft response to AMLA consultation; align with MAS/FSRA equivalents.",
		source: "AMLA work programme 2026",
	},
	{
		title: "IFSC Green-Bond Fast-Track Licensing",
		jurisdiction: "India (GIFT City)",
		sector: "sustainable_finance",
		status: "enacted",
		severity: "medium",
		effectiveDate: "2026-07-01",
		summary:
			"IFSCA will accept green-bond issuance licence applications from Jul 1, with a 30-day review window — significantly faster than GCC equivalents.",
		impact:
			"GIFT City is positioning to dominate Asia-Pacific green-bond issuance. We risk losing market share in this segment.",
		actionRequired:
			"Match the 30-day review window in our framework; co-marketing with a major green-bond issuer to defend share.",
		source: "IFSCA circular GC-2026-07",
	},
	{
		title: "FSRA FinTech Regulatory Lab — Cohort 6",
		jurisdiction: "UAE (ADGM)",
		sector: "fintech",
		status: "under_review",
		severity: "medium",
		effectiveDate: null,
		summary:
			"FSRA is accepting applications for the 6th cohort of its FinTech lab; focus areas include AI compliance, tokenised RWAs, and ESG analytics.",
		impact:
			"ADGM continues to attract high-quality FinTech founders; we need our own equivalent or partnership to stay in the conversation.",
		actionRequired:
			"Evaluate partnership with ADGM for cohort 6; explore sponsoring a local FinTech to join the lab.",
		source: "FSRA announcement 2026-05",
	},
	{
		title: "MAS Variable Capital Company Framework — Amendments",
		jurisdiction: "Singapore",
		sector: "fund_management",
		status: "amended",
		severity: "medium",
		effectiveDate: "2026-06-15",
		summary:
			"MAS has amended the VCC framework to permit side-pocket structures for illiquid asset classes and streamlined fund-of-funds disclosure.",
		impact:
			"Reinforces Singapore's VCC competitiveness; could affect our re-domiciliation pipeline from Singapore-based managers.",
		actionRequired:
			"Compare our fund-vehicle offering against the new VCC rules; consider matching side-pocket provisions.",
		source: "MAS consultation response 2026",
	},
	{
		title: "OECD Pillar Two — Global Minimum Tax Implementation",
		jurisdiction: "Global (OECD)",
		sector: "tax",
		status: "enacted",
		severity: "high",
		effectiveDate: "2026-01-01",
		summary:
			"Pillar Two 15% global minimum tax rules are now in force across most major economies. Effective tax-rate calculations apply to MNE groups with >€750M revenue.",
		impact:
			"Our 0% tax regime is no longer a clean differentiator for in-scope MNEs; we must lean harder on regulatory and ecosystem advantages.",
		actionRequired:
			"Reposition our value proposition around regulatory, talent, and ecosystem attributes; brief IR and BD teams.",
		source: "OECD Pillar Two implementation update",
	},
	{
		title: "ESMA Crypto-Asset Regulation — Final Standards",
		jurisdiction: "EU",
		sector: "digital_assets",
		status: "under_review",
		severity: "medium",
		effectiveDate: null,
		summary:
			"ESMA has published final regulatory technical standards under MiCA for crypto-asset service providers; key items on reverse solicitation and white-paper requirements.",
		impact:
			"Affects any EU-domiciled clients serving EU investors from our jurisdiction; reverse-solicitation carve-out is more limited than initially expected.",
		actionRequired:
			"Legal review of our EU-marketing pathway; brief client teams on white-paper obligations.",
		source: "ESMA MiCA RTS — final",
	},
	{
		title: "QFCA Islamic Finance Rulebook — Modernisation",
		jurisdiction: "Qatar (QFC)",
		sector: "islamic_finance",
		status: "proposed",
		severity: "low",
		effectiveDate: null,
		summary:
			"QFC Authority has proposed updates to its Islamic Finance Rulebook to align with AAOIFI's revised Shari'ah standards.",
		impact:
			"Modest impact; affects our Islamic-finance product set if we serve Qatari institutional clients.",
		actionRequired: "Monitor; respond to consultation if applicable.",
		source: "QFCA consultation IF-2026-02",
	},
];

// ── Tool ──────────────────────────────────────────────────────────

export const regulatoryTrackerTool = createTool({
	name: "track_regulatory_changes",
	description:
		"Track recent and pending regulatory changes filtered by jurisdiction (e.g. 'UAE', 'EU', 'Singapore', 'Global'), sector (e.g. 'digital_assets', 'aml_kyc', 'fund_management'), and optional severity (high, medium, low). Returns structured changes with status, impact assessment, and recommended action. Use this whenever the user asks about regulatory developments, upcoming rules, compliance shifts, or specific sector regulations.",
	parameters: z.object({
		jurisdiction: z
			.string()
			.default("Global")
			.describe(
				"Jurisdiction to filter on, e.g. 'UAE', 'EU', 'Singapore', 'Global'",
			),
		sector: z
			.string()
			.default("all")
			.describe(
				"Sector to filter on, e.g. 'digital_assets', 'aml_kyc', 'fund_management'",
			),
		severity: z
			.enum(["all", "high", "medium", "low"])
			.default("all")
			.describe("Minimum severity"),
	}),
	outputSchema: regulatoryOutputSchema,
	execute: async ({ jurisdiction, sector, severity }) => {
		let filtered = CHANGES;
		if (jurisdiction.toLowerCase() !== "global") {
			filtered = filtered.filter((c) =>
				c.jurisdiction.toLowerCase().includes(jurisdiction.toLowerCase()),
			);
		}
		if (sector.toLowerCase() !== "all") {
			filtered = filtered.filter(
				(c) => c.sector.toLowerCase() === sector.toLowerCase(),
			);
		}
		if (severity !== "all") {
			const order = { high: 0, medium: 1, low: 2 } as const;
			const threshold = order[severity];
			filtered = filtered.filter((c) => order[c.severity] <= threshold);
		}

		return {
			jurisdiction,
			sector,
			severity,
			changes: filtered,
			count: filtered.length,
			note: "Demo-grade curated regulatory intelligence. Production deployment will pull from LexisNexis, Bloomberg Government, and direct regulator feeds.",
		};
	},
});
