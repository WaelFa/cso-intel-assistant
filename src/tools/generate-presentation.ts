// ──────────────────────────────────────────────────────────────────
// Strategic Presentation Generator — McKinsey-Style PPTX Tool
//
// Generates real downloadable .pptx files using the classic
// consulting aesthetic: dark navy backgrounds, white/accent text,
// clean sans-serif typography, and data-driven slide layouts.
//
// Supports three strategic frameworks:
//   - SCR (Situation → Complication → Resolution)
//   - SWOT (Strengths / Weaknesses / Opportunities / Threats)
//   - Executive Summary (headline findings + recommendations)
//
// Generated files are stored in data/presentations/ and served
// via the GET /api/presentations/:id/download endpoint.
// ──────────────────────────────────────────────────────────────────

import { existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createTool } from "@voltagent/core";
import { z } from "zod";

// PptxGenJS has a non-standard export (namespace + default class).
// We import the module and resolve the constructor at runtime.
// eslint-disable-next-line @typescript-eslint/no-require-imports
import PptxGenJSModule from "pptxgenjs";
// biome-ignore lint/suspicious/noExplicitAny: pptxgenjs default import compatibility resolution
const PptxGenJS = (PptxGenJSModule as any).default || PptxGenJSModule;

// Use 'any' for the pptx instance type since the library's type declarations
// are incompatible with standard ESM resolution.
// biome-ignore lint/suspicious/noExplicitAny: PptxGenJS type workaround
type Pptx = any;

// ── Constants ─────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DEFAULT_PRESENTATIONS_DIR = resolve(
	process.env.DATA_DIR ?? join(__dirname, "..", "..", "data"),
	"presentations",
);
const PRESENTATIONS_DIR =
	process.env.PRESENTATIONS_DIR ?? DEFAULT_PRESENTATIONS_DIR;

// McKinsey / BCG classic color palette
const COLORS = {
	navy: "0A1628",
	darkNavy: "060F1D",
	white: "FFFFFF",
	lightGray: "E2E8F0",
	mediumGray: "94A3B8",
	accent: "3B82F6", // Blue accent
	accentGold: "F59E0B", // Gold/amber for highlights
	accentGreen: "10B981",
	accentRed: "EF4444",
	divider: "1E293B",
	cardBg: "111B2E",
};

const FONT = {
	title: "Helvetica Neue",
	body: "Helvetica Neue",
	mono: "Courier New",
};

// ── Slide builders ────────────────────────────────────────────────

function addTitleSlide(
	pptx: Pptx,
	opts: { title: string; subtitle: string; date: string; presenter: string },
) {
	const slide = pptx.addSlide();
	slide.background = { color: COLORS.darkNavy };

	// Top accent line
	slide.addShape(pptx.ShapeType.rect, {
		x: 0,
		y: 0,
		w: "100%",
		h: 0.06,
		fill: { color: COLORS.accent },
	});

	// Title
	slide.addText(opts.title, {
		x: 0.8,
		y: 1.8,
		w: 8.4,
		h: 1.2,
		fontSize: 32,
		fontFace: FONT.title,
		color: COLORS.white,
		bold: true,
		align: "left",
	});

	// Subtitle
	slide.addText(opts.subtitle, {
		x: 0.8,
		y: 3.0,
		w: 8.4,
		h: 0.6,
		fontSize: 16,
		fontFace: FONT.body,
		color: COLORS.mediumGray,
		align: "left",
	});

	// Divider line
	slide.addShape(pptx.ShapeType.rect, {
		x: 0.8,
		y: 3.8,
		w: 2.5,
		h: 0.03,
		fill: { color: COLORS.accent },
	});

	// Date + Presenter
	slide.addText(`${opts.date}  •  ${opts.presenter}`, {
		x: 0.8,
		y: 4.1,
		w: 8.4,
		h: 0.4,
		fontSize: 12,
		fontFace: FONT.body,
		color: COLORS.mediumGray,
		align: "left",
	});

	// Confidential footer
	slide.addText("CONFIDENTIAL — FOR INTERNAL USE ONLY", {
		x: 0.8,
		y: 5.0,
		w: 8.4,
		h: 0.3,
		fontSize: 9,
		fontFace: FONT.mono,
		color: COLORS.divider,
		align: "left",
	});
}

function addAgendaSlide(pptx: Pptx, items: string[]) {
	const slide = pptx.addSlide();
	slide.background = { color: COLORS.darkNavy };

	// Section title
	slide.addText("AGENDA", {
		x: 0.8,
		y: 0.5,
		w: 3,
		h: 0.5,
		fontSize: 11,
		fontFace: FONT.body,
		color: COLORS.accent,
		bold: true,
		charSpacing: 3,
	});

	// Agenda items
	items.forEach((item, idx) => {
		const yPos = 1.4 + idx * 0.7;

		// Number badge
		slide.addText(`${String(idx + 1).padStart(2, "0")}`, {
			x: 0.8,
			y: yPos,
			w: 0.6,
			h: 0.45,
			fontSize: 14,
			fontFace: FONT.mono,
			color: COLORS.accent,
			bold: true,
			align: "left",
			valign: "middle",
		});

		// Item text
		slide.addText(item, {
			x: 1.6,
			y: yPos,
			w: 7.4,
			h: 0.45,
			fontSize: 16,
			fontFace: FONT.body,
			color: COLORS.white,
			align: "left",
			valign: "middle",
		});

		// Divider
		if (idx < items.length - 1) {
			slide.addShape(pptx.ShapeType.rect, {
				x: 1.6,
				y: yPos + 0.55,
				w: 7.4,
				h: 0.01,
				fill: { color: COLORS.divider },
			});
		}
	});
}

function addContentSlide(
	pptx: Pptx,
	opts: { heading: string; body: string; sectionLabel?: string },
) {
	const slide = pptx.addSlide();
	slide.background = { color: COLORS.darkNavy };

	// Top accent bar
	slide.addShape(pptx.ShapeType.rect, {
		x: 0,
		y: 0,
		w: "100%",
		h: 0.04,
		fill: { color: COLORS.accent },
	});

	// Section label
	if (opts.sectionLabel) {
		slide.addText(opts.sectionLabel.toUpperCase(), {
			x: 0.8,
			y: 0.35,
			w: 4,
			h: 0.35,
			fontSize: 10,
			fontFace: FONT.body,
			color: COLORS.accent,
			bold: true,
			charSpacing: 2,
		});
	}

	// Heading
	slide.addText(opts.heading, {
		x: 0.8,
		y: opts.sectionLabel ? 0.75 : 0.5,
		w: 8.4,
		h: 0.6,
		fontSize: 22,
		fontFace: FONT.title,
		color: COLORS.white,
		bold: true,
	});

	// Body text
	slide.addText(opts.body, {
		x: 0.8,
		y: opts.sectionLabel ? 1.5 : 1.3,
		w: 8.4,
		h: 3.8,
		fontSize: 13,
		fontFace: FONT.body,
		color: COLORS.lightGray,
		lineSpacingMultiple: 1.4,
		valign: "top",
		paraSpaceAfter: 8,
	});
}

function addKeyFindingsSlide(
	pptx: Pptx,
	findings: { label: string; detail: string }[],
) {
	const slide = pptx.addSlide();
	slide.background = { color: COLORS.darkNavy };

	slide.addText("KEY FINDINGS", {
		x: 0.8,
		y: 0.35,
		w: 4,
		h: 0.35,
		fontSize: 10,
		fontFace: FONT.body,
		color: COLORS.accent,
		bold: true,
		charSpacing: 2,
	});

	slide.addText("Strategic Assessment Summary", {
		x: 0.8,
		y: 0.75,
		w: 8.4,
		h: 0.5,
		fontSize: 22,
		fontFace: FONT.title,
		color: COLORS.white,
		bold: true,
	});

	const colCount = Math.min(findings.length, 3);
	const colW = 8.4 / colCount - 0.15;

	findings.slice(0, 3).forEach((finding, idx) => {
		const xPos = 0.8 + idx * (colW + 0.2);

		// Card background
		slide.addShape(pptx.ShapeType.rect, {
			x: xPos,
			y: 1.5,
			w: colW,
			h: 3.2,
			fill: { color: COLORS.cardBg },
			rectRadius: 0.08,
		});

		// Accent top strip
		const accentColors = [COLORS.accent, COLORS.accentGold, COLORS.accentGreen];
		slide.addShape(pptx.ShapeType.rect, {
			x: xPos,
			y: 1.5,
			w: colW,
			h: 0.04,
			fill: { color: accentColors[idx] || COLORS.accent },
		});

		// Number
		slide.addText(`${String(idx + 1).padStart(2, "0")}`, {
			x: xPos + 0.2,
			y: 1.7,
			w: 0.5,
			h: 0.4,
			fontSize: 20,
			fontFace: FONT.mono,
			color: accentColors[idx] || COLORS.accent,
			bold: true,
		});

		// Label
		slide.addText(finding.label, {
			x: xPos + 0.2,
			y: 2.15,
			w: colW - 0.4,
			h: 0.5,
			fontSize: 14,
			fontFace: FONT.title,
			color: COLORS.white,
			bold: true,
		});

		// Detail
		slide.addText(finding.detail, {
			x: xPos + 0.2,
			y: 2.7,
			w: colW - 0.4,
			h: 1.8,
			fontSize: 11,
			fontFace: FONT.body,
			color: COLORS.mediumGray,
			lineSpacingMultiple: 1.35,
			valign: "top",
		});
	});
}

function addRecommendationsSlide(pptx: Pptx, recommendations: string[]) {
	const slide = pptx.addSlide();
	slide.background = { color: COLORS.darkNavy };

	slide.addText("RECOMMENDATIONS", {
		x: 0.8,
		y: 0.35,
		w: 4,
		h: 0.35,
		fontSize: 10,
		fontFace: FONT.body,
		color: COLORS.accentGold,
		bold: true,
		charSpacing: 2,
	});

	slide.addText("Strategic Actions Required", {
		x: 0.8,
		y: 0.75,
		w: 8.4,
		h: 0.5,
		fontSize: 22,
		fontFace: FONT.title,
		color: COLORS.white,
		bold: true,
	});

	recommendations.forEach((rec, idx) => {
		const yPos = 1.5 + idx * 0.75;

		// Priority badge
		const priorityColors = [
			COLORS.accentRed,
			COLORS.accentGold,
			COLORS.accent,
			COLORS.accentGreen,
			COLORS.mediumGray,
		];
		slide.addShape(pptx.ShapeType.rect, {
			x: 0.8,
			y: yPos + 0.07,
			w: 0.35,
			h: 0.35,
			fill: { color: priorityColors[idx] || COLORS.accent },
			rectRadius: 0.04,
		});

		slide.addText(`${idx + 1}`, {
			x: 0.8,
			y: yPos + 0.07,
			w: 0.35,
			h: 0.35,
			fontSize: 12,
			fontFace: FONT.mono,
			color: COLORS.white,
			bold: true,
			align: "center",
			valign: "middle",
		});

		// Recommendation text
		slide.addText(rec, {
			x: 1.35,
			y: yPos,
			w: 7.85,
			h: 0.5,
			fontSize: 13,
			fontFace: FONT.body,
			color: COLORS.lightGray,
			valign: "middle",
		});

		// Divider
		if (idx < recommendations.length - 1) {
			slide.addShape(pptx.ShapeType.rect, {
				x: 1.35,
				y: yPos + 0.6,
				w: 7.85,
				h: 0.01,
				fill: { color: COLORS.divider },
			});
		}
	});
}

function addSWOTSlide(
	pptx: Pptx,
	swot: {
		strengths: string[];
		weaknesses: string[];
		opportunities: string[];
		threats: string[];
	},
) {
	const slide = pptx.addSlide();
	slide.background = { color: COLORS.darkNavy };

	slide.addText("STRATEGIC ASSESSMENT", {
		x: 0.8,
		y: 0.35,
		w: 4,
		h: 0.35,
		fontSize: 10,
		fontFace: FONT.body,
		color: COLORS.accent,
		bold: true,
		charSpacing: 2,
	});

	slide.addText("SWOT Analysis", {
		x: 0.8,
		y: 0.75,
		w: 8.4,
		h: 0.5,
		fontSize: 22,
		fontFace: FONT.title,
		color: COLORS.white,
		bold: true,
	});

	const quadrants = [
		{
			label: "STRENGTHS",
			items: swot.strengths,
			color: COLORS.accentGreen,
			x: 0.8,
			y: 1.45,
		},
		{
			label: "WEAKNESSES",
			items: swot.weaknesses,
			color: COLORS.accentRed,
			x: 5.0,
			y: 1.45,
		},
		{
			label: "OPPORTUNITIES",
			items: swot.opportunities,
			color: COLORS.accent,
			x: 0.8,
			y: 3.2,
		},
		{
			label: "THREATS",
			items: swot.threats,
			color: COLORS.accentGold,
			x: 5.0,
			y: 3.2,
		},
	];

	for (const q of quadrants) {
		// Card background
		slide.addShape(pptx.ShapeType.rect, {
			x: q.x,
			y: q.y,
			w: 4.0,
			h: 1.6,
			fill: { color: COLORS.cardBg },
			rectRadius: 0.06,
		});

		// Accent top
		slide.addShape(pptx.ShapeType.rect, {
			x: q.x,
			y: q.y,
			w: 4.0,
			h: 0.04,
			fill: { color: q.color },
		});

		// Label
		slide.addText(q.label, {
			x: q.x + 0.2,
			y: q.y + 0.12,
			w: 3.6,
			h: 0.3,
			fontSize: 10,
			fontFace: FONT.body,
			color: q.color,
			bold: true,
			charSpacing: 1.5,
		});

		// Items
		const text = q.items.map((item) => `•  ${item}`).join("\n");
		slide.addText(text, {
			x: q.x + 0.2,
			y: q.y + 0.45,
			w: 3.6,
			h: 1.0,
			fontSize: 10,
			fontFace: FONT.body,
			color: COLORS.lightGray,
			lineSpacingMultiple: 1.3,
			valign: "top",
		});
	}
}

function addClosingSlide(
	pptx: Pptx,
	opts: { closingMessage: string; nextSteps: string[] },
) {
	const slide = pptx.addSlide();
	slide.background = { color: COLORS.darkNavy };

	// Top accent bar
	slide.addShape(pptx.ShapeType.rect, {
		x: 0,
		y: 0,
		w: "100%",
		h: 0.06,
		fill: { color: COLORS.accent },
	});

	slide.addText("NEXT STEPS", {
		x: 0.8,
		y: 1.5,
		w: 8.4,
		h: 0.5,
		fontSize: 28,
		fontFace: FONT.title,
		color: COLORS.white,
		bold: true,
		align: "center",
	});

	slide.addText(opts.closingMessage, {
		x: 1.5,
		y: 2.2,
		w: 7.0,
		h: 0.6,
		fontSize: 14,
		fontFace: FONT.body,
		color: COLORS.mediumGray,
		align: "center",
	});

	// Next step items
	opts.nextSteps.forEach((step, idx) => {
		const yPos = 3.1 + idx * 0.5;
		slide.addText(`${idx + 1}.  ${step}`, {
			x: 2.0,
			y: yPos,
			w: 6.0,
			h: 0.4,
			fontSize: 13,
			fontFace: FONT.body,
			color: COLORS.lightGray,
			valign: "middle",
		});
	});

	// Footer
	slide.addText("CONFIDENTIAL — FOR INTERNAL USE ONLY", {
		x: 0.8,
		y: 5.0,
		w: 8.4,
		h: 0.3,
		fontSize: 9,
		fontFace: FONT.mono,
		color: COLORS.divider,
		align: "center",
	});
}

// ── Output Schema ─────────────────────────────────────────────────

const presentationOutputSchema = z.object({
	id: z.string().describe("Unique presentation ID (used in download URL)"),
	fileName: z.string().describe("Generated file name"),
	topic: z.string(),
	framework: z.string(),
	slideCount: z.number(),
	filePath: z.string().describe("Absolute path to the generated .pptx file"),
	downloadUrl: z
		.string()
		.describe("Relative URL for downloading: /api/presentations/{id}/download"),
	generatedAt: z.string().describe("ISO 8601 timestamp"),
});

// ── Tool ──────────────────────────────────────────────────────────

export const generatePresentationTool = createTool({
	name: "generate_strategic_presentation",
	description:
		"Generate a McKinsey-style PowerPoint (.pptx) presentation for executive or board audiences. " +
		"Returns a downloadable file. Supports three frameworks: " +
		"'scr' (Situation → Complication → Resolution — best for persuasive narratives), " +
		"'swot' (Strengths / Weaknesses / Opportunities / Threats — best for strategic assessments), " +
		"'executive_summary' (headline findings + recommendations — best for quick board updates). " +
		"Use this whenever the user asks to 'create a presentation', 'generate slides', 'make a deck', " +
		"'build a PowerPoint', or 'prepare a board deck'.",
	parameters: z.object({
		topic: z
			.string()
			.describe(
				"The presentation topic, e.g. 'GCC Digital Assets Strategy Q2 2026'",
			),
		framework: z
			.enum(["scr", "swot", "executive_summary"])
			.describe(
				"Structural framework: 'scr' for Situation-Complication-Resolution, " +
					"'swot' for SWOT analysis, 'executive_summary' for key findings + recommendations",
			),
		presenter: z
			.string()
			.default("CSO Office")
			.describe("Presenter name/title for the title slide"),
		sections: z
			.array(
				z.object({
					heading: z.string().describe("Section or slide heading"),
					content: z
						.string()
						.describe("The body content for this section/slide"),
				}),
			)
			.min(1)
			.describe(
				"The substantive content sections. For SCR: provide Situation, Complication, Resolution sections. " +
					"For SWOT: provide Strengths, Weaknesses, Opportunities, Threats as sections. " +
					"For executive_summary: provide key findings and analysis sections.",
			),
		keyFindings: z
			.array(
				z.object({
					label: z.string().describe("Short finding label (3-5 words)"),
					detail: z
						.string()
						.describe("Finding detail / supporting evidence (1-3 sentences)"),
				}),
			)
			.max(3)
			.optional()
			.describe(
				"Up to 3 key findings for the highlights slide. If omitted, extracted from sections.",
			),
		recommendations: z
			.array(z.string())
			.max(5)
			.optional()
			.describe(
				"Up to 5 strategic recommendations. Each should be a clear action statement.",
			),
		swot: z
			.object({
				strengths: z.array(z.string()),
				weaknesses: z.array(z.string()),
				opportunities: z.array(z.string()),
				threats: z.array(z.string()),
			})
			.optional()
			.describe(
				"Required when framework is 'swot'. Each quadrant should have 2-4 bullet points.",
			),
		nextSteps: z
			.array(z.string())
			.max(4)
			.optional()
			.describe("Next steps for the closing slide (up to 4)"),
	}),
	outputSchema: presentationOutputSchema,
	execute: async ({
		topic,
		framework,
		presenter,
		sections,
		keyFindings,
		recommendations,
		swot,
		nextSteps,
	}) => {
		// Ensure output directory exists
		if (!existsSync(PRESENTATIONS_DIR)) {
			mkdirSync(PRESENTATIONS_DIR, { recursive: true });
		}

		const pptx = new PptxGenJS();
		pptx.layout = "LAYOUT_WIDE"; // 13.33 x 7.5 inches
		pptx.author = "CSO Strategic Intelligence Assistant";
		pptx.title = topic;
		pptx.subject = `${framework.toUpperCase()} Strategic Presentation`;

		const now = new Date();
		const dateStr = now.toLocaleDateString("en-US", {
			year: "numeric",
			month: "long",
			day: "numeric",
		});

		// ── 1. Title Slide ──
		addTitleSlide(pptx, {
			title: topic,
			subtitle: `${framework === "scr" ? "Situation • Complication • Resolution" : framework === "swot" ? "Strategic SWOT Assessment" : "Executive Summary & Recommendations"}`,
			date: dateStr,
			presenter: presenter || "CSO Office",
		});

		// ── 2. Agenda Slide ──
		const agendaItems = sections.map((s) => s.heading);
		if (keyFindings?.length) agendaItems.push("Key Findings");
		if (recommendations?.length) agendaItems.push("Recommendations");
		if (swot) agendaItems.push("SWOT Analysis");
		agendaItems.push("Next Steps & Discussion");
		addAgendaSlide(pptx, agendaItems.slice(0, 6)); // Max 6 agenda items

		// ── 3. Content Slides ──
		const sectionLabels: Record<string, string[]> = {
			scr: ["SITUATION", "COMPLICATION", "RESOLUTION"],
			swot: ["CONTEXT", "ANALYSIS", "STRATEGIC ASSESSMENT"],
			executive_summary: ["EXECUTIVE OVERVIEW", "ANALYSIS", "IMPLICATIONS"],
		};
		const labels = sectionLabels[framework] || [];

		for (let i = 0; i < sections.length; i++) {
			addContentSlide(pptx, {
				heading: sections[i].heading,
				body: sections[i].content,
				sectionLabel: labels[i] || `SECTION ${i + 1}`,
			});
		}

		// ── 4. Key Findings Slide ──
		if (keyFindings?.length) {
			addKeyFindingsSlide(pptx, keyFindings);
		}

		// ── 5. SWOT Slide (if framework is swot) ──
		if (swot) {
			addSWOTSlide(pptx, swot);
		}

		// ── 6. Recommendations Slide ──
		if (recommendations?.length) {
			addRecommendationsSlide(pptx, recommendations);
		}

		// ── 7. Closing Slide ──
		addClosingSlide(pptx, {
			closingMessage:
				"We recommend proceeding with the actions outlined above.",
			nextSteps: nextSteps || [
				"Review and align on recommended actions",
				"Assign ownership and establish timelines",
				"Schedule follow-up review in 2 weeks",
			],
		});

		// ── Generate & Save ──
		const id = `pres-${now.getTime()}-${Math.random().toString(36).substring(2, 8)}`;
		const safeTitle = topic
			.replace(/[^a-zA-Z0-9\s-]/g, "")
			.replace(/\s+/g, "-")
			.substring(0, 60);
		const fileName = `${safeTitle}-${id}.pptx`;
		const filePath = join(PRESENTATIONS_DIR, fileName);

		await pptx.writeFile({ fileName: filePath });

		const slideCount =
			2 + // title + agenda
			sections.length +
			(keyFindings?.length ? 1 : 0) +
			(swot ? 1 : 0) +
			(recommendations?.length ? 1 : 0) +
			1; // closing

		return {
			id,
			fileName,
			topic,
			framework,
			slideCount,
			filePath,
			downloadUrl: `/api/presentations/${id}/download`,
			generatedAt: now.toISOString(),
		};
	},
});
