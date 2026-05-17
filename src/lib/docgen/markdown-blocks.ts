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

/**
 * Convertit un texte inline en runs typés. Supporte **gras** et _italique_
 * (la version simple/legal-friendly, pas le markdown complet).
 */
export function parseInline(line: string): InlineRun[] {
  const runs: InlineRun[] = [];
  const pattern = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_)/g;
  let lastIndex = 0;
  for (const match of line.matchAll(pattern)) {
    if (match.index! > lastIndex) {
      runs.push({ text: line.slice(lastIndex, match.index) });
    }
    const token = match[0];
    if (token.startsWith("**") || token.startsWith("__")) {
      runs.push({ text: token.slice(2, -2), bold: true });
    } else {
      runs.push({ text: token.slice(1, -1), italic: true });
    }
    lastIndex = match.index! + token.length;
  }
  if (lastIndex < line.length) {
    runs.push({ text: line.slice(lastIndex) });
  }
  return runs.length > 0 ? runs : [{ text: line }];
}

