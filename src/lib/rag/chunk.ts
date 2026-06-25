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

/**
 * Renvoie la fin de `text` sur des frontières de PHRASE (et non un slice brut
 * de caractères qui couperait en plein mot), pour un overlap d'au plus
 * ~maxChars. On accumule les phrases depuis la fin tant qu'on tient dans le
 * budget ; on garde toujours au moins la dernière phrase.
 */
function sentenceTail(text: string, maxChars: number): string {
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (sentences.length === 0) return "";
  let tail = sentences[sentences.length - 1];
  for (let i = sentences.length - 2; i >= 0; i--) {
    const candidate = `${sentences[i]} ${tail}`;
    if (candidate.length > maxChars) break;
    tail = candidate;
  }
  return tail;
}

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
    // Un titre Markdown (#, ##, …) ouvre une section : on clôt le chunk courant
    // pour que chaque chunk démarre à une frontière logique et reste collé à
    // son contenu, ce qui améliore nettement la pertinence du RAG sur les
    // documents convertis en Markdown (PDF, OCR).
    const isHeading = /^#{1,6}\s/.test(para);
    if (!buffer) {
      buffer = para;
      continue;
    }
    if (isHeading) {
      chunks.push(buffer);
      buffer = para;
      continue;
    }
    if (buffer.length + 1 + para.length <= CHUNK_SIZE) {
      buffer += "\n" + para;
      continue;
    }
    chunks.push(buffer);
    // Overlap par phrases entières (pas un slice brut) pour que le contexte
    // repris d'un chunk à l'autre ne soit pas un fragment en plein mot.
    const tail = sentenceTail(buffer, CHUNK_OVERLAP);
    buffer = (tail ? tail + "\n" : "") + para;
  }
  if (buffer && chunks.length < MAX_CHUNKS) chunks.push(buffer);

  return chunks;
}
