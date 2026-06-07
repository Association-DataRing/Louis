import type { DocumentSpec, ListItem, Section } from "./types";

/**
 * Convertit le document JSON d'un éditeur Tiptap (ProseMirror) en
 * `DocumentSpec`, pour le ré-exporter en .docx via `generateDocx` — donc
 * en réutilisant le style maison (police Cambria, marges, footer Page X/Y).
 *
 * Limites assumées (MVP) :
 *  - Le générateur .docx (`parseInline`) ne connaît que **gras** et _italique_.
 *    Le souligné et les liens sont donc rendus en texte simple à l'export.
 *  - Le 1er bloc de l'éditeur devient le titre (convention « titre en tête »,
 *    naturelle pour un acte), pour round-tripper proprement avec le bloc-titre
 *    que `generateDocx` rend toujours en haut.
 */

type PMMark = { type: string };
type PMNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: PMNode[];
  text?: string;
  marks?: PMMark[];
};

/** Texte brut d'un contenu inline (marks ignorées) — pour titres/headings. */
function inlineToPlain(content: PMNode[] | undefined): string {
  if (!content) return "";
  return content
    .map((n) => (n.type === "text" ? (n.text ?? "") : n.type === "hardBreak" ? " " : ""))
    .join("");
}

/**
 * Échappe les caractères que `parseInline` interpréterait comme du markdown
 * (`*`, `_`) ainsi que le backslash lui-même. Indispensable pour ne pas
 * corrompre le texte littéral d'un acte (placeholders `article_2`, blancs à
 * remplir `____`, expressions `3 * 4`) lors du round-trip éditeur → DOCX.
 */
function escapeInline(text: string): string {
  return text.replace(/([\\*_])/g, "\\$1");
}

/** Contenu inline → markdown gras/italique (le reste passe en texte brut). */
function inlineToMarkdown(content: PMNode[] | undefined): string {
  if (!content) return "";
  let out = "";
  for (const node of content) {
    if (node.type === "hardBreak") {
      out += " ";
      continue;
    }
    if (node.type !== "text" || !node.text) continue;
    let t = escapeInline(node.text);
    const marks = new Set((node.marks ?? []).map((m) => m.type));
    if (marks.has("bold")) t = `**${t}**`;
    if (marks.has("italic")) t = `_${t}_`;
    out += t;
  }
  return out;
}

/**
 * Aplatit récursivement une liste Tiptap en `ListItem[]` porteurs de leur
 * niveau. Corrige deux pertes de l'ancienne version : (1) seul le 1er paragraphe
 * d'un item était lu — on lit désormais TOUS les blocs de texte de l'item ;
 * (2) les sous-listes étaient ignorées — on descend dedans en incrémentant le
 * niveau. Le type (numéroté/à puces) du parent s'applique aux sous-niveaux.
 */
function collectListItems(
  listNode: PMNode,
  level: number,
  out: ListItem[]
): void {
  for (const li of listNode.content ?? []) {
    if (li.type !== "listItem") continue;
    const children = li.content ?? [];
    const ownText = children
      .filter((c) => c.type !== "bulletList" && c.type !== "orderedList")
      .map((c) => inlineToMarkdown(c.content))
      .filter((s) => s.trim().length > 0)
      .join(" ");
    if (ownText.trim()) out.push({ text: ownText, level });
    for (const c of children) {
      if (c.type === "bulletList" || c.type === "orderedList") {
        collectListItems(c, level + 1, out);
      }
    }
  }
}

function blockToSections(node: PMNode): Section[] {
  switch (node.type) {
    case "heading": {
      const lvl = Number(node.attrs?.level ?? 2);
      const level = (lvl >= 1 && lvl <= 4 ? lvl : 3) as 1 | 2 | 3 | 4;
      return [{ kind: "heading", level, text: inlineToPlain(node.content) }];
    }
    case "paragraph": {
      const content = inlineToMarkdown(node.content);
      // Paragraphe vide → espace vertical (préserve le rythme de l'acte).
      return content.trim()
        ? [{ kind: "paragraph", content }]
        : [{ kind: "spacer", lines: 1 }];
    }
    case "bulletList":
    case "orderedList": {
      const items: ListItem[] = [];
      collectListItems(node, 0, items);
      return items.length
        ? [{ kind: "list", ordered: node.type === "orderedList", items }]
        : [];
    }
    case "blockquote": {
      const text = (node.content ?? [])
        .map((p) => inlineToMarkdown(p.content))
        .filter((s) => s.trim().length > 0)
        .join(" ");
      return text ? [{ kind: "blockquote", content: text }] : [];
    }
    case "horizontalRule":
      return [{ kind: "hr" }];
    default: {
      // Type inconnu : on tente de récupérer le texte plutôt que le perdre.
      const t = inlineToMarkdown(node.content);
      return t.trim() ? [{ kind: "paragraph", content: t }] : [];
    }
  }
}

export function editorJsonToSpec(
  doc: PMNode,
  fallbackTitle: string
): DocumentSpec {
  const blocks = doc.content ?? [];

  // Premier bloc non vide = titre ; le reste = corps.
  let title = fallbackTitle;
  let rest = blocks;
  if (blocks.length > 0) {
    const firstText = inlineToPlain(blocks[0].content).trim();
    if (firstText) {
      title = firstText;
      rest = blocks.slice(1);
    }
  }

  const sections = rest.flatMap(blockToSections);
  return { title, sections, fontFamily: "serif" };
}
