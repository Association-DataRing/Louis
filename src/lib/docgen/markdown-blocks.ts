/**
 * Parseur Markdown minimaliste pour la génération DOCX / PDF.
 *
 * Pour les usages juridiques visés (mises en demeure, mémos, projets de
 * clauses, comptes-rendus) on n'a besoin que d'une grammaire bloc simple.
 * Pas de tables ni de code fences — un avocat préfère un .docx propre à
 * un Markdown technique.
 */

export type InlineRun = {
  text: string;
  bold?: boolean;
  italic?: boolean;
};

/** Retire un niveau d'échappement (`\x` → `x`). */
function unescapeInline(s: string): string {
  return s.replace(/\\([\s\S])/g, "$1");
}

/**
 * Convertit un texte inline en runs typés. Supporte **gras** et _italique_
 * (la version simple/legal-friendly, pas le markdown complet).
 *
 * Les caractères `*` / `_` précédés d'un backslash sont traités comme
 * littéraux et n'ouvrent/ferment pas d'emphase — ce qui permet à
 * `from-prosemirror` de préserver le texte brut d'un acte au round-trip.
 * Le texte non échappé (markdown généré par l'IA) garde le comportement
 * historique.
 */
export function parseInline(line: string): InlineRun[] {
  const runs: InlineRun[] = [];
  let buf = "";
  let i = 0;

  const flush = () => {
    if (buf) {
      runs.push({ text: buf });
      buf = "";
    }
  };

  // Cherche le délimiteur de fermeture `delim` à partir de `from`, en
  // ignorant les occurrences échappées (précédées d'un backslash).
  const findClose = (delim: string, from: number): number => {
    let j = from;
    while (j <= line.length - delim.length) {
      if (line[j] === "\\") {
        j += 2;
        continue;
      }
      if (line.startsWith(delim, j)) return j;
      j += 1;
    }
    return -1;
  };

  while (i < line.length) {
    const ch = line[i];

    // Échappement : `\x` → `x` littéral.
    if (ch === "\\" && i + 1 < line.length) {
      buf += line[i + 1];
      i += 2;
      continue;
    }

    // Gras : `**…**` ou `__…__`.
    const two = line.slice(i, i + 2);
    if (two === "**" || two === "__") {
      const close = findClose(two, i + 2);
      if (close > i + 2) {
        flush();
        runs.push({ text: unescapeInline(line.slice(i + 2, close)), bold: true });
        i = close + 2;
        continue;
      }
    }

    // Italique : `*…*` ou `_…_`.
    if (ch === "*" || ch === "_") {
      const close = findClose(ch, i + 1);
      if (close > i + 1) {
        flush();
        runs.push({ text: unescapeInline(line.slice(i + 1, close)), italic: true });
        i = close + 1;
        continue;
      }
    }

    buf += ch;
    i += 1;
  }
  flush();
  return runs.length > 0 ? runs : [{ text: line }];
}

