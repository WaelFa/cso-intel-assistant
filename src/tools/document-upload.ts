// ──────────────────────────────────────────────────────────────────
// Document Upload Tool — adds a document to the RAG store.
//
// This is a factory function (not a top-level `createTool` constant)
// because the tool needs a reference to the live DocumentStore
// instance, which is constructed in src/index.ts and injected here.
// Same dependency-injection pattern as the agent factories in
// src/agents/agents.ts.
//
// Input contract (Zod):
//   - name      : original filename (kept for source attribution)
//   - mimeType  : optional, helps parser dispatch
//   - content   : base64-encoded file bytes
//   - kind      : optional explicit override (pdf / docx / txt / md)
//
// Output contract:
//   - documentId, chunkCount, characterCount, kind
//   - firstChunks: a small preview (≤ 3) so the chat UI can
//     immediately show the user what got ingested.
// ──────────────────────────────────────────────────────────────────

import { createTool } from "@voltagent/core";
import { z } from "zod";
import {
	type DocumentStore,
	detectKind,
	extractText,
} from "../retriever/index.js";

/** Build a `createTool` instance bound to a given DocumentStore. */
export function createDocumentUploadTool(store: DocumentStore) {
	return createTool({
		name: "upload_document",
		description:
			"Upload a document (PDF, DOCX, TXT, or Markdown) to the assistant's knowledge base. The document is parsed, chunked, embedded, and indexed for semantic search. Use this when the user provides a PDF, board paper, memo, or any other text-bearing file they want the assistant to be able to reference. Returns a documentId and chunk count so the user knows the upload succeeded.",
		parameters: z.object({
			name: z
				.string()
				.describe("Original filename, e.g. 'Q1-2026-board-minutes.pdf'"),
			mimeType: z
				.string()
				.nullable()
				.default(null)
				.describe("Optional MIME type hint, e.g. 'application/pdf'"),
			content: z
				.string()
				.describe(
					"Base64-encoded file bytes. Use a data-URI prefix if convenient — it will be stripped.",
				),
			kind: z
				.enum(["pdf", "docx", "txt", "md"])
				.optional()
				.describe(
					"Optional explicit kind override; otherwise inferred from filename / mimeType",
				),
		}),
		execute: async ({ name, mimeType, content, kind }) => {
			const detected = kind ?? detectKind(name, mimeType);
			const bytes = decodeBase64(content);
			const text = await extractText(bytes, detected, name);

			const doc = await store.ingest({
				name,
				kind: detected,
				text,
				source: "upload",
			});

			return {
				documentId: doc.id,
				name: doc.name,
				kind: doc.kind,
				chunkCount: doc.chunkCount,
				characterCount: doc.characterCount,
				uploadedAt: doc.uploadedAt,
				preview: makePreview(text, 3),
				note: "Document indexed for semantic search. Ask the assistant a question and retrieval will cite this document by name and chunk index.",
			};
		},
	});
}

// ── Helpers ───────────────────────────────────────────────────────

/**
 * Decode a base64 string, stripping an optional `data:<mime>;base64,` prefix
 * that some clients include.
 */
function decodeBase64(input: string): Buffer {
	const cleaned = input.replace(/^data:[^;]+;base64,/, "").trim();
	return Buffer.from(cleaned, "base64");
}

/** First N non-empty paragraphs, truncated, for an immediate ingest preview. */
function makePreview(text: string, count: number): string[] {
	const paragraphs = text
		.split(/\n\s*\n/)
		.map((p) => p.replace(/\s+/g, " ").trim())
		.filter((p) => p.length > 20);
	return paragraphs
		.slice(0, count)
		.map((p) => (p.length > 240 ? `${p.slice(0, 239).trimEnd()}…` : p));
}
