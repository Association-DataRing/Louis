/**
 * Parseur Markdown minimaliste pour la génération DOCX / PDF.
 *
 * Pour les usages juridiques visés (mises en demeure, mémos, projets de
 * clauses, comptes-rendus) on n'a besoin que d'une grammaire bloc simple.
 * Pas de tables ni de code fences — un avocat préfère un .docx propre à
 * un Markdown technique.
 */

export type Block =
  | { kind: "heading"; level: 1 | 2 | 3; text: string }
  | { kind: "paragraph"; runs: InlineRun[] }
  | { kind: "list"; ordered: boolean; items: InlineRun[][] }
  | { kind: "blockquote"; runs: InlineRun[] }
  | { kind: "hr" };

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

/**
 * Découpe un markdown en blocs typés.
 */
export function parseMarkdownBlocks(md: string): Block[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];

  let buffer: string[] = [];
  let listMode: { ordered: boolean; items: string[] } | null = null;

  function flushParagraph() {
    if (buffer.length === 0) return;
    const text = buffer.join(" ").trim();
    buffer = [];
    if (text.length === 0) return;
    blocks.push({ kind: "paragraph", runs: parseInline(text) });
  }

  function flushList() {
    if (!listMode) return;
    blocks.push({
      kind: "list",
      ordered: listMode.ordered,
      items: listMode.items.map(parseInline),
    });
    listMode = null;
  }

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (line.trim().length === 0) {
      flushParagraph();
      flushList();
      continue;
    }

    const headingMatch = /^(#{1,3})\s+(.+)$/.exec(line);
    if (headingMatch) {
      flushParagraph();
      flushList();
      blocks.push({
        kind: "heading",
        level: headingMatch[1].length as 1 | 2 | 3,
        text: headingMatch[2].trim(),
      });
      continue;
    }

    if (/^(---|\*\*\*|___)$/.test(line.trim())) {
      flushParagraph();
      flushList();
      blocks.push({ kind: "hr" });
      continue;
    }

    if (line.startsWith("> ")) {
      flushParagraph();
      flushList();
      blocks.push({
        kind: "blockquote",
        runs: parseInline(line.slice(2).trim()),
      });
      continue;
    }

    const bullet = /^[-*+]\s+(.+)$/.exec(line);
    if (bullet) {
      flushParagraph();
      if (!listMode || listMode.ordered) {
        flushList();
        listMode = { ordered: false, items: [] };
      }
      listMode.items.push(bullet[1].trim());
      continue;
    }

    const ordered = /^\d+\.\s+(.+)$/.exec(line);
    if (ordered) {
      flushParagraph();
      if (!listMode || !listMode.ordered) {
        flushList();
        listMode = { ordered: true, items: [] };
      }
      listMode.items.push(ordered[1].trim());
      continue;
    }

    flushList();
    buffer.push(line);
  }

  flushParagraph();
  flushList();

  return blocks;
}
