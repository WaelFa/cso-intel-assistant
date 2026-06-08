// ──────────────────────────────────────────────────────────────────
// Document Retrieval Tool — runs a RAG query against the
// DocumentStore and returns top-k chunks with source attribution.
//
// Factory function (same pattern as document-upload.ts): the tool
// is bound to a specific DocumentStore instance at server boot.
//
// Output contract:
//   - chunks : array of { documentName, chunkIndex, score, excerpt }
//   - sources: unique list of (documentName, documentId) pairs
//              that contributed to the answer — this is what the
//              supervisor uses to render inline citations like
//              "[Q1-2026-board-minutes.pdf, chunk 4]".
//   - note   : explicit disclaimer when the store is empty, so the
//              model doesn't fabricate an answer.
// ──────────────────────────────────────────────────────────────────

import { createTool } from "@voltagent/core";
import { z } from "zod";
import type { DocumentStore } from "../retriever/index.js";

/** Build a `createTool` instance bound to a given DocumentStore. */
export function createDocumentRetrievalTool(store: DocumentStore) {
	return createTool({
		name: "retrieve_documents",
		description:
			"Search the document knowledge base for chunks relevant to a natural-language question. Use this whenever the user asks a question that might be answered by a previously uploaded document (board minutes, strategy paper, regulatory filing, etc.). Returns top-k excerpts with the source filename, chunk index, and a relevance score so the answer can be cited. If the knowledge base is empty, returns a clear 'no documents indexed' response — do not invent an answer in that case.",
		parameters: z.object({
			query: z
				.string()
				.describe("The question or topic to search for, in natural language"),
			topK: z
				.number()
				.int()
				.min(1)
				.max(15)
				.default(5)
				.describe("How many chunks to return (1-15, default 5)"),
		}),
		execute: async ({ query, topK }) => {
			const totalDocs = store.listDocuments().length;
			if (totalDocs === 0) {
				return {
					query,
					topK,
					totalDocuments: 0,
					chunks: [],
					sources: [],
					note: "No documents have been indexed yet. Ask the user to upload a PDF, DOCX, TXT, or MD file via the upload_document tool, or restart the server to re-ingest the seed corpus.",
				};
			}

			const hits = await store.search(query, { topK });
			if (hits.length === 0) {
				return {
					query,
					topK,
					totalDocuments: totalDocs,
					chunks: [],
					sources: uniqueSources(store, []),
					note: "No relevant chunks were found for this query in the indexed documents. Try rephrasing the question, broadening the topic, or uploading additional source material.",
				};
			}

			return {
				query,
				topK,
				totalDocuments: totalDocs,
				chunks: hits.map((h) => ({
					documentId: h.documentId,
					documentName: h.documentName,
					chunkIndex: h.chunkIndex,
					excerpt: h.excerpt,
					score: h.score,
				})),
				sources: uniqueSources(store, hits),
				note: "Always cite the source document name and chunk index when the answer draws on these chunks, e.g. 'Source: Q1-2026-board-minutes.pdf, chunk 7 (relevance 0.82)'.",
			};
		},
	});
}

// ── Helpers ───────────────────────────────────────────────────────

function uniqueSources(
	store: DocumentStore,
	hits: { documentId: string; documentName: string }[],
): {
	documentId: string;
	documentName: string;
	kind: string;
	source: string;
}[] {
	// If we have hits, use their unique documentIds; otherwise list everything.
	const seen = new Set<string>();
	const ids: string[] = [];
	for (const h of hits) {
		if (!seen.has(h.documentId)) {
			seen.add(h.documentId);
			ids.push(h.documentId);
		}
	}
	if (ids.length === 0) {
		for (const d of store.listDocuments()) ids.push(d.id);
	}
	const byId = new Map(store.listDocuments().map((d) => [d.id, d]));
	return ids
		.map((id) => byId.get(id))
		.filter((d): d is NonNullable<typeof d> => Boolean(d))
		.map((d) => ({
			documentId: d.id,
			documentName: d.name,
			kind: d.kind,
			source: d.source,
		}));
}
