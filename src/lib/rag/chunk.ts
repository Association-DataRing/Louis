/**
 * Naive but effective text chunking : split on paragraph boundaries, group
 * consecutive paragraphs until ~CHUNK_SIZE chars, keep a small overlap with
 * the previous chunk so a sentence that spans a boundary stays retrievable
 * from either side.
 *
 * Designed for the typical 800–1200 token window of `mistral-embed`, where
 * 800–1000 characters (~250 tokens) is the sweet spot.
 */

const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 100;
const MAX_CHUNKS = 4000; // hard cap → ~3.2 M chars max per document

export function chunkText(input: string): string[] {
  const normalized = input.replace(/\r\n?/g, "\n").trim();
  if (!normalized) return [];

  // Prefer paragraph splits; if a paragraph is huge, fall back to sentences.
  const paragraphs = normalized
    .split(/\n{2,}/)
    .flatMap((p) =>
      p.length <= CHUNK_SIZE
        ? [p]
        : p.split(/(?<=[.!?])\s+/).filter(Boolean)
    )
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let buffer = "";

  for (const para of paragraphs) {
    if (chunks.length >= MAX_CHUNKS) break;
    if (!buffer) {
      buffer = para;
      continue;
    }
    if (buffer.length + 1 + para.length <= CHUNK_SIZE) {
      buffer += "\n" + para;
      continue;
    }
    chunks.push(buffer);
    const tail = buffer.slice(Math.max(0, buffer.length - CHUNK_OVERLAP));
    buffer = tail + "\n" + para;
  }
  if (buffer && chunks.length < MAX_CHUNKS) chunks.push(buffer);

  return chunks;
}
