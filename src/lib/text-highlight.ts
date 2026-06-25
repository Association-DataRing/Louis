/**
 * Strip diacritical marks + lowercase.
 * "révélation" → "revelation", "Ça" → "ca"
 */
export function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Finds the [start, end) range in the original string `s` where the
 * normalized (diacritics stripped, lowercased) form of `needle` matches.
 *
 * Handles NFC/NFD divergence between sources — e.g. pdfjs emits NFD-encoded
 * text items while LLM output is NFC. A plain indexOf would miss those matches.
 *
 * Returns null if not found.
 */
export function findNormalized(
  s: string,
  needle: string
): [number, number] | null {
  if (!needle) return null;
  const normNeedle = stripDiacritics(needle);
  if (!normNeedle) return null;

  // Build a parallel normalized string and a mapping: norm index → orig index.
  const origIndices: number[] = [];
  let normStr = "";
  let i = 0;
  while (i < s.length) {
    const cp = s.codePointAt(i)!;
    const char = String.fromCodePoint(cp);
    const step = char.length; // 2 for surrogate pairs, 1 otherwise
    const normChars = stripDiacritics(char);
    for (const nc of normChars) {
      normStr += nc;
      origIndices.push(i);
    }
    i += step;
  }

  const idx = normStr.indexOf(normNeedle);
  if (idx < 0) return null;
  const origStart = origIndices[idx];
  const endNormIdx = idx + normNeedle.length;
  const origEnd =
    endNormIdx < origIndices.length ? origIndices[endNormIdx] : s.length;
  return [origStart, origEnd];
}

// Longueurs d'essai décroissantes : on commence par le needle le plus long
// (plus spécifique, moins de faux positifs) et on replie vers des versions
// plus courtes si le texte source a été légèrement reformaté ou OCR'd.
const NEEDLE_STEPS = [120, 60, 30] as const;

/**
 * Essaie findNormalized avec des needles de longueur décroissante.
 * Utile quand la source (pdfjs, OCR) diverge légèrement du targetText LLM :
 * un needle de 120 chars peut rater à cause d'un espace ou d'un tiret,
 * alors qu'un needle de 60 chars matche sans ambiguïté.
 */
export function findNormalizedAdaptive(
  s: string,
  needle: string
): [number, number] | null {
  for (const len of NEEDLE_STEPS) {
    const truncated = needle.slice(0, len);
    if (truncated.length < 8) break;
    const result = findNormalized(s, truncated);
    if (result) return result;
  }
  return null;
}
