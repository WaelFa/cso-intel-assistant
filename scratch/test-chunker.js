import fs from 'node:fs';

// This is the modified chunker logic
export function chunkTextCorrected(
	text,
	opts = {},
) {
	const chunkSize = opts.chunkSize ?? 1000;
	const overlap = opts.overlap ?? 200;

	const normalized = text
		.replace(/\r\n/g, "\n")
		.replaceAll(String.fromCharCode(0), "")
		.trim();
	if (!normalized) return [];
	if (normalized.length <= chunkSize) return [normalized];

	const chunks = [];
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
		
		// If we've reached the end of the text, stop chunking
		if (cut >= normalized.length) break;
		
		if (cut <= cursor) break;
		cursor = Math.max(cut - overlap, cursor + 1);
	}
	return chunks;
}

const text = fs.readFileSync('./data/seed/01-annual-strategy-2026.md', 'utf-8');
const chunks = chunkTextCorrected(text);

console.log(`Text length: ${text.length}`);
console.log(`Number of chunks with corrected chunker: ${chunks.length}`);

console.log('\n--- ALL CHUNKS ---');
chunks.forEach((chunk, i) => {
  console.log(`Chunk ${i} (length: ${chunk.length}):`);
  console.log(JSON.stringify(chunk));
  console.log('---');
});
