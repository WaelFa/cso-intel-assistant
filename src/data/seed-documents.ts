// ──────────────────────────────────────────────────────────────────
// Seed Document Loader
//
// Reads the curated Markdown corpus from `data/seed/` and ingests
// each file into the live DocumentStore on server boot. This gives
// the assistant a default "library" of strategic documents it can
// cite from the moment the server comes up — critical for demos
// where there is no time to upload files manually.
//
// Why MD (not PDF) for the seed corpus:
//   - Committable to git, diff-friendly, and human-readable.
//   - No binary parsing edge cases during boot.
//   - The upload_document tool itself handles PDFs/DOCX correctly.
//     The seed corpus is a starting point; live users can still
//     upload real PDFs through the API.
//
// Failure mode:
//   - Missing or empty `data/seed/` directory is non-fatal: the
//     server boots, but the knowledge base starts empty.
//   - One bad seed file is logged and skipped — it must not block
//     the whole boot or the rest of the corpus.
// ──────────────────────────────────────────────────────────────────

import { readFile, readdir } from "node:fs/promises";
import { extname, isAbsolute, join, resolve } from "node:path";
import { type DocumentStore, detectKind } from "../retriever/index.js";

/** Default location of the seed corpus, relative to the repo root. */
const DEFAULT_SEED_DIR = "data/seed";

/**
 * Resolve the seed directory to an absolute path.
 *
 * Resolution order:
 *   1. Explicit `opts.seedDir` (caller-provided absolute path).
 *   2. The `SEED_DIR` env var, if set.
 *   3. `<process.cwd()>/data/seed` (the convention for `npm run dev`).
 *
 * We deliberately do NOT walk up from the module path: the build
 * output may live in `dist/` (production) or `src/` (dev), and
 * module-path resolution is brittle when the package is bundled.
 * Relying on CWD keeps the loader predictable.
 */
function resolveSeedDir(seedDir: string | undefined): string {
	if (seedDir)
		return isAbsolute(seedDir) ? seedDir : resolve(process.cwd(), seedDir);
	if (process.env.SEED_DIR) {
		const env = process.env.SEED_DIR;
		return isAbsolute(env) ? env : resolve(process.cwd(), env);
	}
	return resolve(process.cwd(), DEFAULT_SEED_DIR);
}

/**
 * Ingest every file in `data/seed/` into the store. Returns a summary
 * that can be logged at boot. Tolerates an empty/missing directory.
 */
export async function seedDocuments(
	store: DocumentStore,
	opts: {
		seedDir?: string;
		logger?: {
			info: (m: string) => void;
			warn: (m: string) => void;
			error: (m: string) => void;
		};
	} = {},
): Promise<{
	attempted: number;
	ingested: number;
	skipped: number;
	errors: string[];
}> {
	const log = opts.logger ?? console;
	const seedDir = resolveSeedDir(opts.seedDir);

	let entries: string[] = [];
	try {
		const files = await readdir(seedDir);
		entries = files
			.filter((f) => /\.(md|markdown|txt|pdf|docx)$/i.test(f))
			.sort();
	} catch (err) {
		log.warn(
			`[seed] No seed directory at ${seedDir} — knowledge base will start empty.`,
		);
		return { attempted: 0, ingested: 0, skipped: 0, errors: [] };
	}

	if (entries.length === 0) {
		log.warn(
			`[seed] Seed directory ${seedDir} is empty — knowledge base will start empty.`,
		);
		return { attempted: 0, ingested: 0, skipped: 0, errors: [] };
	}

	let ingested = 0;
	let skipped = 0;
	const errors: string[] = [];

	for (const file of entries) {
		// Skip if already ingested under the same name (idempotency on restart
		// is nice to have, but for now we allow re-ingest — see store.ingest).
		if (store.hasName(file, "seed")) {
			skipped++;
			continue;
		}

		const fullPath = join(seedDir, file);
		try {
			const isText = /\.(md|markdown|txt)$/i.test(file);
			const text = isText
				? await readFile(fullPath, "utf-8")
				: await readBinaryAsText(fullPath, file);

			const doc = await store.ingest({
				name: file,
				kind: detectKind(file, isText ? "text/plain" : null),
				text,
				source: "seed",
			});
			ingested++;
			log.info(
				`[seed] Ingested ${file} (${doc.kind}, ${doc.chunkCount} chunks, ${doc.characterCount.toLocaleString()} chars)`,
			);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			errors.push(`${file}: ${msg}`);
			log.error(`[seed] Failed to ingest ${file}: ${msg}`);
		}
	}

	return { attempted: entries.length, ingested, skipped, errors };
}

/** Read a PDF/DOCX as text for the seed loader. Re-uses retriever extraction. */
async function readBinaryAsText(
	fullPath: string,
	filename: string,
): Promise<string> {
	const ext = extname(filename).toLowerCase();
	const bytes = await readFile(fullPath);
	const { extractText, detectKind } = await import("../retriever/index.js");
	return extractText(bytes, detectKind(filename), filename);
}
