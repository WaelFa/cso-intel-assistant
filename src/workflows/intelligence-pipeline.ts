// ──────────────────────────────────────────────────────────────────
// Intelligence Pipeline — gather → RAG cross-ref → synthesize → classify.
//
// This is a three-step workflow the CSO can invoke explicitly to get
// a fully-grounded, document-cited, urgency-labelled answer to a
// strategic question. It complements (does not replace) the
// ad-hoc tool use the supervisor does day-to-day.
//
// Step shape:
//
//   1. rag          — semantic search over the document knowledge
//                     base for the user's question. Returns the top-k
//                     chunks with source attribution. The "gather"
//                     step is folded into this: we record the
//                     library size and search time as part of the
//                     rag output for the final packaging step.
//   2. synthesize   — delegate to the supervisor agent with the
//                     retrieved chunks and a description of the live
//                     tools (briefing / risk / perf) it can call.
//   3. classify     — final packaging step: merges the LLM's urgency
//                     verdict (or the user override), the cited
//                     sources, and the synthesised answer into the
//                     workflow output shape.
//
// Wiring:
//   - The workflow is created by `createIntelligencePipeline(...)`
//     and registered with the VoltAgent app in src/index.ts.
//   - The supervisor agent does NOT call this directly; it is
//     invoked via the VoltAgent `/workflows/<id>/run` HTTP endpoint
//     or programmatically by a UI button. Keeping it as a separate
//     workflow lets us showcase the workflow primitive in the demo
//     without forcing every chat turn through it.
//
// Type plumbing note:
//   `andThen`'s INPUT generic is not auto-inferred from `inputSchema`
//   (the schema is for runtime validation, not type inference), so
//   we pass the explicit type parameter on each step.
// ──────────────────────────────────────────────────────────────────

import { andAgent, andThen, createWorkflow } from "@voltagent/core";
import type { Agent } from "@voltagent/core";
import { z } from "zod";
import type { DocumentStore } from "../retriever/index.js";

// ── Input / Output Schemas ────────────────────────────────────────

const inputSchema = z.object({
	question: z
		.string()
		.min(8)
		.describe("The strategic question to answer (the user prompt)"),
	topK: z
		.number()
		.int()
		.min(1)
		.max(10)
		.default(5)
		.describe("How many document chunks to retrieve"),
	urgencyHint: z
		.enum(["critical", "elevated", "nominal", "auto"])
		.default("auto")
		.describe("Urgency override; 'auto' derives from the synthesised text"),
});

type PipelineInput = z.infer<typeof inputSchema>;

const chunkSchema = z.object({
	documentId: z.string(),
	documentName: z.string(),
	chunkIndex: z.number().int(),
	excerpt: z.string(),
	score: z.number(),
});

const ragOutputSchema = z.object({
	chunks: z.array(chunkSchema),
	empty: z.boolean(),
	note: z.string(),
	gatheredAt: z.string(),
	documentCount: z.number().int(),
});

const synthOutputSchema = z.object({
	answer: z.string(),
	urgency: z.enum(["critical", "elevated", "nominal"]),
	urgencyReason: z.string(),
});

const resultSchema = z.object({
	question: z.string(),
	urgency: z.enum(["critical", "elevated", "nominal"]),
	urgencyReason: z.string(),
	documentSources: z.array(
		z.object({
			documentId: z.string(),
			documentName: z.string(),
			chunkIndex: z.number().int(),
			score: z.number(),
		}),
	),
	answer: z.string(),
	ranAt: z.string(),
});

// ── Factory ───────────────────────────────────────────────────────

export interface IntelligencePipelineDeps {
	documentStore: DocumentStore;
	supervisorAgent: Agent;
}

/**
 * Build the three-step pipeline. Dependencies are closed over by the
 * factory so the steps themselves can stay declarative.
 */
export function createIntelligencePipeline({
	documentStore,
	supervisorAgent,
}: IntelligencePipelineDeps) {
	// ── Step 1: gather + rag ─────────────────────────────────────
	// INPUT = PipelineInput (the workflow input).
	// DATA   = PipelineInput (the workflow input — first step).
	// RESULT = ragOutputSchema.
	const ragStep = andThen<
		PipelineInput,
		PipelineInput,
		z.infer<typeof ragOutputSchema>
	>({
		id: "rag-retrieval",
		execute: async ({ getInitData }) => {
			const init = getInitData<PipelineInput>();
			const docs = documentStore.listDocuments();
			const hits = await documentStore.search(init.question, {
				topK: init.topK,
			});
			return {
				chunks: hits.map((h) => ({
					documentId: h.documentId,
					documentName: h.documentName,
					chunkIndex: h.chunkIndex,
					excerpt: h.excerpt,
					score: h.score,
				})),
				empty: hits.length === 0,
				note:
					hits.length === 0
						? "No relevant chunks found in the document knowledge base for this question."
						: `Retrieved ${hits.length} chunk(s) from the document knowledge base.`,
				gatheredAt: new Date().toISOString(),
				documentCount: docs.length,
			};
		},
	});

	// ── Step 2: synthesize ───────────────────────────────────────
	// INPUT = PipelineInput. DATA = rag output. RESULT = synth output.
	const synthesizeStep = andAgent<
		PipelineInput,
		z.infer<typeof ragOutputSchema>,
		typeof synthOutputSchema
	>(
		async ({ getInitData, getStepResult }) => {
			const init = getInitData<PipelineInput>();
			const rag =
				getStepResult<z.infer<typeof ragOutputSchema>>("rag-retrieval");

			const ctxText = rag?.empty
				? rag.note
				: (rag?.chunks ?? [])
						.map(
							(c) =>
								`[Source: ${c.documentName} · chunk ${c.chunkIndex} · relevance ${c.score.toFixed(3)}]\n${c.excerpt}`,
						)
						.join("\n\n");

			return [
				{
					role: "user" as const,
					content: `You are answering a CSO strategic question end-to-end. The question, the retrieved documents, and a description of the live tools are below.

# Question
${init.question}

# Retrieved Document Chunks
${ctxText}

# Live Tools Available
You (the supervisor agent) have these tools; call whichever apply before answering:
- generate_daily_briefing — the morning intelligence snapshot
- get_risk_indicators — current risk dashboard
- get_performance_metrics — organisational KPIs and initiative progress
- retrieve_documents — additional semantic search if you need more
- Sub-agents: market-intelligence, regulatory-intelligence, competitive-intelligence, executive-communications

# Your Job
1. Decide which live tools to call (briefing / risks / perf) given the question.
2. Synthesise an executive-grade answer that is grounded in the retrieved chunks where they apply, AND in the live tool output where the question is about the present.
3. Always cite sources inline: \`[Source: filename.md, chunk 4, relevance 0.82]\`.
4. End with a "Strategic Implications" section and a "Recommended Actions" section.
5. Classify urgency as critical / elevated / nominal with a one-sentence reason.

Return JSON with this exact shape: { "answer": string, "urgency": "critical" | "elevated" | "nominal", "urgencyReason": string }`,
				},
			];
		},
		supervisorAgent,
		{
			schema: synthOutputSchema,
		},
	);

	// ── Step 3: package ─────────────────────────────────────────
	// The final step's RESULT must match the workflow's `result`
	// schema. Note that in VoltAgent, the final step's DATA is the
	// supervisor agent's output, not the workflow's RESULT — we
	// therefore build the result object here.
	const packageStep = andThen<
		PipelineInput,
		z.infer<typeof synthOutputSchema>,
		z.infer<typeof resultSchema>
	>({
		id: "package-result",
		execute: async ({ getInitData, getStepResult }) => {
			const init = getInitData<PipelineInput>();
			const rag =
				getStepResult<z.infer<typeof ragOutputSchema>>("rag-retrieval");
			const synth = getStepResult<z.infer<typeof synthOutputSchema>>(
				"cso-intel-assistant",
			);

			const safeSynth = synth ?? {
				answer:
					"The supervisor agent did not return a structured answer for this run.",
				urgency: "nominal" as const,
				urgencyReason: "Fallback: missing agent output.",
			};

			// Note: the andAgent step's ID defaults to the agent's
			// ID ("cso-intel-assistant"), so that's what we look up.

			const urgency =
				init.urgencyHint === "auto" ? safeSynth.urgency : init.urgencyHint;

			return {
				question: init.question,
				urgency,
				urgencyReason: safeSynth.urgencyReason,
				documentSources: (rag?.chunks ?? []).map((c) => ({
					documentId: c.documentId,
					documentName: c.documentName,
					chunkIndex: c.chunkIndex,
					score: c.score,
				})),
				answer: safeSynth.answer,
				ranAt: new Date().toISOString(),
			};
		},
	});

	return createWorkflow(
		{
			id: "intelligence-pipeline",
			name: "intelligence-pipeline",
			purpose:
				"Gather live context, cross-reference uploaded documents via RAG, synthesise a cited answer, and classify urgency.",
			input: inputSchema,
			result: resultSchema,
		},
		ragStep,
		synthesizeStep,
		packageStep,
	);
}
