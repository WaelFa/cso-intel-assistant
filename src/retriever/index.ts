// ──────────────────────────────────────────────────────────────────
// Document Retriever — the heart of the RAG layer.
//
// Responsibilities:
//   1. Parse uploaded files (PDF / DOCX / TXT / MD) → plain text
//   2. Chunk the text with a recursive character splitter
//   3. Embed each chunk via the shared OpenRouter embedding model
//   4. Store vectors + metadata in an in-memory vector DB
//   5. Serve similarity searches with source attribution
//
// Design notes:
//   - One DocumentStore per server process. The vector DB is
//     in-memory, so it is rebuilt on every restart (the seed
//     loader in src/data/seed-documents.ts repopulates it).
//   - We use a SEPARATE InMemoryVectorAdapter from the one used
//     by Memory (conversation history). Keeping document chunks
//     and conversation messages in distinct stores avoids ID
//     collisions and makes reasoning about each store easier.
//   - The chunker is deliberately simple: a paragraph- and
//     sentence-aware sliding window. For Phase 3 (a few hundred
//     pages of seed material) this is more than sufficient.
//   - Source attribution is first-class: every stored chunk
//     carries `documentId`, `documentName`, `chunkIndex`, and
//     `page` (where known) so the retriever can hand citations
//     straight back to the LLM and dashboard.
// ──────────────────────────────────────────────────────────────────

import { createHash, randomUUID } from "node:crypto";
import { InMemoryVectorAdapter } from "@voltagent/core";

// ── Types ─────────────────────────────────────────────────────────

export type DocumentKind = "pdf" | "docx" | "txt" | "md";

/**
 * Minimal embedding contract the DocumentStore depends on.
 *
 * Decoupling from any specific AI SDK version (V1 / V3 / etc.)
 * keeps the store portable: the caller can wrap the AI SDK
 * embedding model in a tiny adapter that satisfies this shape.
 */
export interface Embedder {
	embedOne(text: string): Promise<number[]>;
	embedMany(texts: string[]): Promise<number[][]>;
}

export interface DocumentChunk {
	id: string;
	documentId: string;
	documentName: string;
	chunkIndex: number;
	page?: number;
	content: string;
}

export interface StoredDocument {
	id: string;
	name: string;
	kind: DocumentKind;
	uploadedAt: string;
	chunkCount: number;
	characterCount: number;
	source: "upload" | "seed";
}

export interface ScoredChunk {
	id: string;
	documentId: string;
	documentName: string;
	chunkIndex: number;
	page?: number;
	excerpt: string;
	score: number;
}

export interface SearchOptions {
	topK?: number;
	threshold?: number;
}

// ── Parser dispatch ───────────────────────────────────────────────

/**
 * Extract plain text from a binary buffer / string based on kind.
 * PDF and DOCX parsers are dynamically imported to avoid loading
 * their native-ish dependencies until they are actually needed.
 */
export async function extractText(
	bytes: Buffer | string,
	kind: DocumentKind,
	filename: string,
): Promise<string> {
	if (kind === "txt" || kind === "md") {
		return typeof bytes === "string" ? bytes : bytes.toString("utf-8");
	}
	if (kind === "pdf") {
		// pdf-parse@1.1.1 has a top-level read of a test PDF on import when loaded as ESM,
		// because module.parent is undefined. Using createRequire from node:module avoids this.
		const { createRequire } = await import("node:module");
		const require = createRequire(import.meta.url);
		const pdfParse = require("pdf-parse") as (
			b: Buffer,
		) => Promise<{ text: string }>;
		const buf = typeof bytes === "string" ? Buffer.from(bytes, "utf-8") : bytes;
		const result = await pdfParse(buf);
		return result.text;
	}
	if (kind === "docx") {
		const mammoth = await import("mammoth");
		const buf = typeof bytes === "string" ? Buffer.from(bytes, "utf-8") : bytes;
		const result = await mammoth.extractRawText({ buffer: buf });
		return result.value;
	}
	throw new Error(`Unsupported document kind: ${kind} (${filename})`);
}

/**
 * Best-effort kind detection from a filename and (optional) mime type.
 * Defaults to "txt" for unknown extensions so callers can still
 * pre-populate text snippets.
 */
export function detectKind(
	filename: string,
	mimeType?: string | null,
): DocumentKind {
	const lower = filename.toLowerCase();
	const mt = (mimeType ?? "").toLowerCase();
	if (mt === "application/pdf" || lower.endsWith(".pdf")) return "pdf";
	if (
		mt ===
			"application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
		lower.endsWith(".docx")
	)
		return "docx";
	if (
		mt === "text/markdown" ||
		lower.endsWith(".md") ||
		lower.endsWith(".markdown")
	)
		return "md";
	if (lower.endsWith(".txt")) return "txt";
	// Fall back to txt so the rest of the pipeline still works
	return "txt";
}

// ── Chunking ──────────────────────────────────────────────────────

/**
 * Recursive, character-based chunker.
 * - Tries to keep paragraphs intact (split on \n\n)
 * - Then sentences (split on . ! ? followed by whitespace)
 * - Then words (sliding window) as a last resort
 * - Emits overlapping chunks so a sentence that straddles a
 *   boundary is still captured in its entirety.
 */
export function chunkText(
	text: string,
	opts: { chunkSize?: number; overlap?: number } = {},
): string[] {
	const chunkSize = opts.chunkSize ?? 1000;
	const overlap = opts.overlap ?? 200;

	const normalized = text
		.replace(/\r\n/g, "\n")
		.replaceAll(String.fromCharCode(0), "")
		.trim();
	if (!normalized) return [];
	if (normalized.length <= chunkSize) return [normalized];

	const chunks: string[] = [];
	let cursor = 0;
	while (cursor < normalized.length) {
		const end = Math.min(cursor + chunkSize, normalized.length);

		// Try to back off to a paragraph / sentence boundary
		let cut = end;
		if (end < normalized.length) {
			const window = normalized.slice(cursor, end);
			const paraBreak = window.lastIndexOf("\n\n");
			const sentenceBreak = Math.max(
				window.lastIndexOf(". "),
				window.lastIndexOf("? "),
				window.lastIndexOf("! "),
			);
			if (paraBreak > chunkSize * 0.5) cut = cursor + paraBreak + 2;
			else if (sentenceBreak > chunkSize * 0.5)
				cut = cursor + sentenceBreak + 2;
		}

		const piece = normalized.slice(cursor, cut).trim();
		if (piece.length > 0) chunks.push(piece);
		if (cut >= normalized.length) break;
		if (cut <= cursor) break;
		cursor = Math.max(cut - overlap, cursor + 1);
	}
	return chunks;
}

// ── DocumentStore ─────────────────────────────────────────────────

/**
 * Singleton-style store for uploaded document chunks.
 *
 * Not actually a TS singleton — we instantiate one in src/index.ts
 * and inject it into the tools. This keeps it testable and
 * dependency-injectable, matching the rest of the codebase.
 */
export class DocumentStore {
	private readonly vectorStore = new InMemoryVectorAdapter();
	private readonly documents = new Map<string, StoredDocument>();
	private readonly chunksByDoc = new Map<string, DocumentChunk[]>();
	private readonly embedder: Embedder;

	constructor(embedder: Embedder) {
		this.embedder = embedder;
	}

	/** Embed a single string → number[] (delegates to the supplied embedder). */
	private async embedOne(text: string): Promise<number[]> {
		return this.embedder.embedOne(text);
	}

	/** Embed a batch of strings → number[][]. */
	private async embedMany(texts: string[]): Promise<number[][]> {
		if (texts.length === 0) return [];
		return this.embedder.embedMany(texts);
	}

	/**
	 * Ingest raw text or a parsed buffer. Returns the StoredDocument
	 * record (with chunk count) so the upload tool can echo it back
	 * to the user / dashboard.
	 */
	async ingest(input: {
		name: string;
		kind: DocumentKind;
		text: string;
		source: "upload" | "seed";
	}): Promise<StoredDocument> {
		const documentId = createHash("sha1")
			.update(`${input.source}:${input.name}:${Date.now()}:${randomUUID()}`)
			.digest("hex")
			.slice(0, 16);

		const pieces = chunkText(input.text);
		if (pieces.length === 0) {
			throw new Error(
				`Document "${input.name}" produced no chunks (empty or unreadable)`,
			);
		}

		const vectors = await this.embedMany(pieces);
		const chunks: DocumentChunk[] = pieces.map((content, i) => ({
			id: `${documentId}:${i}`,
			documentId,
			documentName: input.name,
			chunkIndex: i,
			content,
		}));

		// Store all vectors in one batch for efficiency.
		// InMemoryVectorAdapter only persists `metadata` (the top-level
		// `content` field on VectorItem is dropped on read), so we
		// fold the chunk content into metadata as well.
		await this.vectorStore.storeBatch(
			chunks.map((c, i) => ({
				id: c.id,
				vector: vectors[i],
				metadata: {
					documentId: c.documentId,
					documentName: c.documentName,
					chunkIndex: c.chunkIndex,
					content: c.content,
				},
			})),
		);

		const doc: StoredDocument = {
			id: documentId,
			name: input.name,
			kind: input.kind,
			uploadedAt: new Date().toISOString(),
			chunkCount: chunks.length,
			characterCount: input.text.length,
			source: input.source,
		};
		this.documents.set(documentId, doc);
		this.chunksByDoc.set(documentId, chunks);
		return doc;
	}

	/**
	 * Run a similarity search. Returns top-k chunks with source
	 * attribution and a relevance score in [0, 1].
	 */
	async search(
		query: string,
		opts: SearchOptions = {},
	): Promise<ScoredChunk[]> {
		const topK = opts.topK ?? 5;
		const threshold = opts.threshold ?? 0.0;
		if (this.documents.size === 0) return [];

		const queryVector = await this.embedOne(query);
		const results = await this.vectorStore.search(queryVector, {
			limit: Math.max(topK * 2, topK), // over-fetch to allow threshold filtering
			threshold,
		});

		return results.slice(0, topK).map((r) => {
			const meta = (r.metadata ?? {}) as {
				documentId?: string;
				documentName?: string;
				chunkIndex?: number;
				content?: string;
			};
			const fullContent = meta.content ?? r.content ?? "";
			return {
				id: r.id,
				documentId: meta.documentId ?? "",
				documentName: meta.documentName ?? "Unknown",
				chunkIndex: meta.chunkIndex ?? 0,
				excerpt: makeExcerpt(fullContent, 280),
				score: roundScore(r.score),
			};
		});
	}

	/** Return the list of documents currently in the store. */
	listDocuments(): StoredDocument[] {
		return Array.from(this.documents.values()).sort((a, b) =>
			a.uploadedAt.localeCompare(b.uploadedAt),
		);
	}

	/** Total number of chunks across all documents. */
	totalChunks(): number {
		let n = 0;
		for (const chunks of this.chunksByDoc.values()) n += chunks.length;
		return n;
	}

	/** Has this document name been ingested under this source label? */
	hasName(name: string, source: "upload" | "seed"): boolean {
		for (const d of this.documents.values()) {
			if (d.name === name && d.source === source) return true;
		}
		return false;
	}

	/** Delete a document and all of its chunks from the vector store and maps. */
	async deleteDocument(documentId: string): Promise<boolean> {
		const doc = this.documents.get(documentId);
		if (!doc) return false;

		const chunks = this.chunksByDoc.get(documentId) ?? [];
		const chunkIds = chunks.map((c) => c.id);

		if (chunkIds.length > 0) {
			await this.vectorStore.deleteBatch(chunkIds);
		}

		this.documents.delete(documentId);
		this.chunksByDoc.delete(documentId);
		return true;
	}
}


// ── Helpers ───────────────────────────────────────────────────────

function makeExcerpt(text: string, max: number): string {
	const t = text.replace(/\s+/g, " ").trim();
	if (t.length <= max) return t;
	return `${t.slice(0, max - 1).trimEnd()}…`;
}

function roundScore(n: number): number {
	return Math.round(n * 1000) / 1000;
}

// ── AI SDK V3 → Embedder adapter ──────────────────────────────────

/**
 * Wrap an AI SDK V3 embedding model (e.g. from
 * `@ai-sdk/openai-compatible`'s `embeddingModel()`) in our
 * minimal `Embedder` interface. This keeps the DocumentStore
 * portable across AI SDK major versions.
 */
export function createAiSdkEmbedder(aiSdkEmbeddingModel: {
	doEmbed: (opts: { values: string[] }) => PromiseLike<{
		embeddings?: number[][];
	}>;
}): Embedder {
	return {
		async embedOne(text) {
			const result = await aiSdkEmbeddingModel.doEmbed({ values: [text] });
			const v = result.embeddings?.[0];
			if (!v) throw new Error("Embedding model returned no vectors");
			return v;
		},
		async embedMany(texts) {
			if (texts.length === 0) return [];
			const result = await aiSdkEmbeddingModel.doEmbed({ values: texts });
			if (!result.embeddings || result.embeddings.length !== texts.length) {
				throw new Error(
					`Embedding batch size mismatch: expected ${texts.length}, got ${result.embeddings?.length ?? 0}`,
				);
			}
			return result.embeddings;
		},
	};
}
