// ──────────────────────────────────────────────────────────────────
// Executive Communications Tool — generates a structured
// document framework (board paper, stakeholder update, memo,
// talking points, presentation outline) for a given topic and
// list of key points.
//
// The tool returns a *structured scaffold* with the recommended
// headings, audience cues, and length guidance. The exec-comms
// sub-agent then *fills the scaffold with prose* and returns the
// final draft. This split keeps the tool output machine-readable
// (Zod-validated) while the prose remains the agent's strength.
//
// P2 in priority, but kept functional so the supervisor's prompt
// (which already references "drafting board papers, memos, talking
// points") is honest about the LLM's available capabilities.
// ──────────────────────────────────────────────────────────────────

import { createTool } from "@voltagent/core";
import { z } from "zod";

// ── Output Schema ─────────────────────────────────────────────────

const sectionSchema = z.object({
	heading: z.string(),
	guidance: z.string().describe("What this section should accomplish"),
	targetLength: z
		.string()
		.describe("e.g. '3-4 sentences', '≤ 1 paragraph', 'bullet list'"),
});

const draftOutputSchema = z.object({
	contentType: z.string(),
	topic: z.string(),
	title: z.string().describe("Suggested document title"),
	audience: z.string().describe("Primary audience, e.g. 'Board of Directors'"),
	structure: z.array(sectionSchema),
	tone: z.string(),
	lengthGuidance: z.string(),
	boilerplate: z.object({
		openingLine: z.string(),
		closingLine: z.string(),
	}),
	note: z.string(),
});

// ── Templates by content type ─────────────────────────────────────

const TEMPLATES: Record<
	string,
	{
		title: (topic: string) => string;
		audience: string;
		structure: z.infer<typeof sectionSchema>[];
		tone: string;
		length: string;
		opening: string;
		closing: string;
	}
> = {
	board_paper: {
		title: (t) => `Board Paper — ${t}`,
		audience: "Board of Directors",
		structure: [
			{
				heading: "Executive Summary",
				guidance: "3-4 sentences. The headline finding + the ask of the Board.",
				targetLength: "3-4 sentences",
			},
			{
				heading: "Background and Context",
				guidance:
					"Frame the issue; include market, regulatory, and competitive context as relevant.",
				targetLength: "1-2 paragraphs",
			},
			{
				heading: "Analysis and Key Findings",
				guidance: "The data, the trade-offs, the counter-arguments considered.",
				targetLength: "2-3 paragraphs or table",
			},
			{
				heading: "Strategic Implications",
				guidance:
					"So what? What this means for our positioning, our pipeline, our risk.",
				targetLength: "1-2 paragraphs",
			},
			{
				heading: "Recommendations",
				guidance:
					"Numbered, with clear actions, owners, and timelines. Make the ask explicit.",
				targetLength: "numbered list (3-5 items)",
			},
			{
				heading: "Risk Considerations",
				guidance:
					"Key risks, mitigations, and the residual risk the Board should accept.",
				targetLength: "1 paragraph or short table",
			},
			{
				heading: "Next Steps and Timeline",
				guidance: "What happens after this paper is approved, and by when.",
				targetLength: "short bullet list",
			},
		],
		tone: "Authoritative, measured, evidence-driven. No marketing language.",
		length: "Max 2 pages.",
		opening: "This paper seeks Board approval / endorsement of the following:",
		closing:
			"Subject to Board feedback, the executive team proposes to proceed as outlined above.",
	},
	stakeholder_update: {
		title: (t) => `Stakeholder Update — ${t}`,
		audience:
			"Key external stakeholders (regulators, sovereign investors, partners)",
		structure: [
			{
				heading: "Headline",
				guidance: "One sentence — the single most important update.",
				targetLength: "1 sentence",
			},
			{
				heading: "What Changed",
				guidance: "Concrete, specific developments since the last update.",
				targetLength: "bullet list (3-6 items)",
			},
			{
				heading: "What It Means for You",
				guidance: "Translate the change into the stakeholder's interests.",
				targetLength: "1 short paragraph",
			},
			{
				heading: "What's Next",
				guidance: "What we expect over the next quarter.",
				targetLength: "1 short paragraph",
			},
		],
		tone: "Professional, transparent, partner-like. Avoid jargon unless industry-standard.",
		length: "1 page.",
		opening: "We are writing to brief you on recent developments:",
		closing: "We will provide our next update at the end of the quarter.",
	},
	memo: {
		title: (t) => `Executive Memo — ${t}`,
		audience: "C-suite and senior leadership",
		structure: [
			{
				heading: "Bottom Line",
				guidance: "The headline, the action needed, by when.",
				targetLength: "1-2 sentences",
			},
			{
				heading: "Context",
				guidance: "Why this matters now. 1 paragraph max.",
				targetLength: "1 paragraph",
			},
			{
				heading: "Analysis",
				guidance: "Key data, options considered, recommendation.",
				targetLength: "1-2 paragraphs",
			},
			{
				heading: "Recommendation and Next Step",
				guidance: "The single action requested, with owner and date.",
				targetLength: "1-2 sentences",
			},
		],
		tone: "Direct, executive-friendly, no preamble.",
		length: "Max 1 page.",
		opening: "Memo to: C-suite. From: CSO Office. Re:",
		closing: "Decision requested by [date].",
	},
	talking_points: {
		title: (t) => `Talking Points — ${t}`,
		audience: "CSO for an upcoming meeting or event",
		structure: [
			{
				heading: "Opening Framing",
				guidance: "How to open the conversation. 1-2 sentences.",
				targetLength: "1-2 sentences",
			},
			{
				heading: "Three Key Messages",
				guidance:
					"The three points you want the audience to walk away remembering.",
				targetLength: "3 bullets, each 1-2 sentences",
			},
			{
				heading: "Anticipated Questions",
				guidance: "Q&A prep — the 3-4 most likely questions and crisp answers.",
				targetLength: "3-4 short Q&A pairs",
			},
			{
				heading: "Closing Line",
				guidance:
					"How to land the conversation. Strong, specific, forward-looking.",
				targetLength: "1 sentence",
			},
		],
		tone: "Confident, conversational, executive.",
		length: "1 page; rehearsal-ready.",
		opening: "Opening: anchor in a recent specific development...",
		closing: "Close with the forward ask / commitment.",
	},
	presentation_outline: {
		title: (t) => `Presentation Outline — ${t}`,
		audience: "Mixed executive / board audience",
		structure: [
			{
				heading: "Title Slide",
				guidance: "Title, subtitle, date, presenter.",
				targetLength: "1 slide",
			},
			{
				heading: "Agenda",
				guidance: "3-5 items. Set the path of the presentation.",
				targetLength: "1 slide",
			},
			{
				heading: "Context / Why Now",
				guidance: "The backdrop. Make the audience care.",
				targetLength: "1-2 slides",
			},
			{
				heading: "Analysis / Key Findings",
				guidance: "The substance. Data, comparisons, case studies.",
				targetLength: "3-5 slides",
			},
			{
				heading: "Strategic Implications and Recommendations",
				guidance: "The 'so what' and the 'ask'.",
				targetLength: "1-2 slides",
			},
			{
				heading: "Discussion / Q&A",
				guidance: "Anchor the discussion in 2-3 specific questions.",
				targetLength: "1 slide",
			},
		],
		tone: "Visual-led; each slide one core message. Notes for the presenter only on speaker slides.",
		length: "8-12 slides; 15-20 minute runtime.",
		opening: "Open with the question the room is asking.",
		closing: "End with the specific decision or next step.",
	},
};

// ── Tool ──────────────────────────────────────────────────────────

export const draftContentTool = createTool({
	name: "draft_executive_content",
	description:
		"Generate a structured document scaffold (board paper, stakeholder update, memo, talking points, or presentation outline) for a given topic and list of key points. Returns a heading-by-heading framework with audience cues, length guidance, and tone — the exec-comms sub-agent then fills the scaffold with prose. Use this whenever the user asks to 'draft a board paper', 'write a memo', 'prepare talking points', etc.",
	parameters: z.object({
		contentType: z.enum([
			"board_paper",
			"stakeholder_update",
			"memo",
			"talking_points",
			"presentation_outline",
		]),
		topic: z
			.string()
			.describe("The document topic, e.g. 'Digital Assets Strategy Review'"),
		keyPoints: z
			.array(z.string())
			.min(1)
			.describe("The specific points the document should cover"),
	}),
	outputSchema: draftOutputSchema,
	execute: async ({ contentType, topic, keyPoints }) => {
		const tpl = TEMPLATES[contentType];
		// Annotate the first section to incorporate the user's key points.
		const structure = tpl.structure.map((s, idx) => {
			if (idx === 0) {
				return {
					...s,
					guidance: `${s.guidance} Cover these key points: ${keyPoints.join("; ")}.`,
				};
			}
			return s;
		});

		return {
			contentType,
			topic,
			title: tpl.title(topic),
			audience: tpl.audience,
			structure,
			tone: tpl.tone,
			lengthGuidance: tpl.length,
			boilerplate: {
				openingLine: tpl.opening,
				closingLine: tpl.closing,
			},
			note:
				"This is a scaffold the exec-comms sub-agent will fill with prose. " +
				"The final draft should follow the structure, length, and tone guidance exactly.",
		};
	},
});
