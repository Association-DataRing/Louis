/**
 * Tracked changes Word natifs.
 *
 * Lit un .docx, applique une liste d'éditions {find, replace, context} comme
 * de vrais `<w:ins>` / `<w:del>` avec auteur + date + id. Le fichier obtenu
 * s'ouvre dans Word/Pages/LibreOffice avec les marques de révision visibles —
 * Accept/Reject natif depuis l'onglet Révision.
 *
 * Version compacte qui couvre le 80% utile (substitutions intra-paragraphe
 * avec context_before/after). Ne gère pas les tracked-changes pré-existants
 * ni les insertions multi-runs dispersés.
 */

import JSZip from "jszip";
import { XMLParser, XMLBuilder } from "fast-xml-parser";

export type EditInput = {
  find: string;
  replace: string;
  context_before?: string;
  context_after?: string;
  reason?: string;
};

export type AppliedEdit = {
  index: number;
  find: string;
  replace: string;
  reason?: string;
  /** Paragraphe (0-indexé) où l'édit a été placé. */
  paragraph: number;
  trackedId: number;
};

export type EditError = {
  index: number;
  reason: "not_found" | "ambiguous" | "empty" | "internal";
  message: string;
};

export type ApplyResult = {
  buffer: Buffer;
  applied: AppliedEdit[];
  errors: EditError[];
};

const WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  allowBooleanAttributes: true,
  preserveOrder: true,
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: false,
});

const xmlBuilder = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  preserveOrder: true,
  format: false,
  suppressEmptyNode: false,
});

type XNode = Record<string, unknown>;

function elName(node: XNode): string | null {
  for (const key of Object.keys(node)) {
    if (!key.startsWith("@_") && key !== ":@") return key;
  }
  return null;
}

function elChildren(node: XNode): XNode[] {
  const name = elName(node);
  if (!name) return [];
  const value = (node as Record<string, unknown>)[name];
  return Array.isArray(value) ? (value as XNode[]) : [];
}

function setElChildren(node: XNode, children: XNode[]): void {
  const name = elName(node);
  if (!name) return;
  (node as Record<string, unknown>)[name] = children;
}

/** Extrait le `:@` (attributs) d'un nœud preserveOrder. */
function elAttrs(node: XNode): Record<string, string> | undefined {
  const at = (node as Record<string, unknown>)[":@"];
  return at as Record<string, string> | undefined;
}

/** Walk récursif : applique cb à chaque w:p trouvé, dans les tables aussi. */
function forEachParagraph(
  nodes: XNode[],
  cb: (paraChildren: XNode[], setChildren: (children: XNode[]) => void) => void
): void {
  for (const node of nodes) {
    const name = elName(node);
    if (!name) continue;
    if (name === "w:p") {
      cb(elChildren(node), (children) => setElChildren(node, children));
    } else if (
      name === "w:body" ||
      name === "w:tbl" ||
      name === "w:tr" ||
      name === "w:tc" ||
      name === "w:sdt" ||
      name === "w:sdtContent"
    ) {
      forEachParagraph(elChildren(node), cb);
    }
  }
}

function findBody(tree: XNode[]): XNode[] | null {
  for (const node of tree) {
    if (elName(node) === "w:document") {
      for (const child of elChildren(node)) {
        if (elName(child) === "w:body") {
          return elChildren(child);
        }
      }
    }
  }
  return null;
}

/** Normalise les whitespaces pour que matching soit tolérant aux \t \n etc. */
function normalize(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Concatène le texte de tous les w:t d'un paragraphe + retourne un mapping
 * indice-caractère → (indice du run, position interne). Permet ensuite de
 * découper précisément le run qui contient le match.
 */
type RunPos = {
  runIdx: number; // index dans paraChildren
  textInRun: string; // texte du w:t de ce run
  startInPara: number; // position du 1er caractère du w:t dans le texte concaténé
};

function flattenRuns(paraChildren: XNode[]): {
  text: string;
  runs: RunPos[];
} {
  const runs: RunPos[] = [];
  let text = "";
  paraChildren.forEach((child, idx) => {
    if (elName(child) !== "w:r") return;
    for (const grand of elChildren(child)) {
      if (elName(grand) === "w:t") {
        const inner = elChildren(grand);
        // w:t a soit une string directement (#text) soit un seul child {#text: ...}
        let txt = "";
        for (const piece of inner) {
          const n = elName(piece);
          if (n === "#text") {
            const v = (piece as Record<string, unknown>)["#text"];
            if (typeof v === "string") txt += v;
          }
        }
        runs.push({
          runIdx: idx,
          textInRun: txt,
          startInPara: text.length,
        });
        text += txt;
      }
    }
  });
  return { text, runs };
}

/**
 * Cherche `find` dans le texte normalisé du paragraphe avec un contexte
 * optionnel autour. Renvoie la position dans le texte ORIGINAL (non
 * normalisé) ou null. Multi-match -> "ambiguous".
 */
type LocateResult =
  | { kind: "ok"; start: number; end: number }
  | { kind: "ambiguous" }
  | { kind: "miss" };

function locate(
  paraText: string,
  find: string,
  ctxBefore: string,
  ctxAfter: string
): LocateResult {
  const target = normalize(ctxBefore) + normalize(find) + normalize(ctxAfter);
  const before = normalize(ctxBefore);
  const findN = normalize(find);

  // Construit un mapping normalisé -> position originale.
  // Plus simple : on calcule la version normalisée et on garde un index map
  // « pour chaque caractère normalisé, à quelle position du texte original
  // correspond-il ? ».
  const orig = paraText;
  const normChars: string[] = [];
  const idxMap: number[] = []; // normPos -> origPos
  let prevSpace = false;
  let i = 0;
  // skip leading whitespace
  while (i < orig.length && /\s/.test(orig[i])) i++;
  for (; i < orig.length; i++) {
    const c = orig[i];
    if (/\s/.test(c)) {
      if (prevSpace) continue;
      normChars.push(" ");
      idxMap.push(i);
      prevSpace = true;
    } else {
      normChars.push(c);
      idxMap.push(i);
      prevSpace = false;
    }
  }
  // trim trailing
  while (normChars.length > 0 && normChars[normChars.length - 1] === " ") {
    normChars.pop();
    idxMap.pop();
  }
  const normText = normChars.join("");

  const occurrences: number[] = [];
  let from = 0;
  while (true) {
    const at = normText.indexOf(target, from);
    if (at < 0) break;
    occurrences.push(at);
    from = at + 1;
  }
  if (occurrences.length === 0) return { kind: "miss" };
  if (occurrences.length > 1) return { kind: "ambiguous" };
  const matchStart = occurrences[0] + before.length;
  const matchEnd = matchStart + findN.length;
  if (matchEnd > idxMap.length) return { kind: "miss" };
  return {
    kind: "ok",
    start: idxMap[matchStart],
    end: matchEnd === idxMap.length ? orig.length : idxMap[matchEnd],
  };
}

function buildRun(rPr: XNode | null, text: string, preserveSpace = false): XNode {
  const tNode: XNode = {
    "w:t": [{ "#text": text } as XNode],
  };
  if (preserveSpace || /^\s|\s$/.test(text)) {
    tNode[":@"] = { "@_xml:space": "preserve" };
  }
  const runChildren: XNode[] = [];
  if (rPr) runChildren.push(rPr);
  runChildren.push(tNode);
  return { "w:r": runChildren };
}

function buildIns(
  trackedId: number,
  author: string,
  dateIso: string,
  rPr: XNode | null,
  text: string
): XNode {
  return {
    "w:ins": [buildRun(rPr, text, true)],
    ":@": {
      "@_w:id": String(trackedId),
      "@_w:author": author,
      "@_w:date": dateIso,
    },
  };
}

function buildDel(
  trackedId: number,
  author: string,
  dateIso: string,
  rPr: XNode | null,
  text: string
): XNode {
  // Pour la suppression : <w:r><w:rPr/><w:delText>...</w:delText></w:r> dans <w:del>
  const delText: XNode = {
    "w:delText": [{ "#text": text } as XNode],
  };
  if (/^\s|\s$/.test(text)) {
    delText[":@"] = { "@_xml:space": "preserve" };
  }
  const runChildren: XNode[] = [];
  if (rPr) runChildren.push(rPr);
  runChildren.push(delText);
  return {
    "w:del": [{ "w:r": runChildren }],
    ":@": {
      "@_w:id": String(trackedId),
      "@_w:author": author,
      "@_w:date": dateIso,
    },
  };
}

/**
 * Applique l'édit dans le paragraphe : remplace dans le run qui contient le
 * match par <w:r prefix><w:del original></w:del><w:ins replacement></w:ins><w:r suffix>.
 * On retire le run d'origine et on insère 0..3 nouveaux nœuds à sa place.
 */
function spliceParagraph(
  paraChildren: XNode[],
  matchStart: number,
  matchEnd: number,
  replacement: string,
  trackedIds: { del: number; ins: number },
  author: string,
  dateIso: string
): boolean {
  const flat = flattenRuns(paraChildren);
  // Trouve le run qui contient le matchStart. On suppose match intra-run.
  let containingRun: RunPos | null = null;
  for (const r of flat.runs) {
    const runEnd = r.startInPara + r.textInRun.length;
    if (matchStart >= r.startInPara && matchEnd <= runEnd) {
      containingRun = r;
      break;
    }
  }
  if (!containingRun) {
    // Match traverse plusieurs runs — non supporté en v1.
    return false;
  }
  const cr = containingRun;
  const beforeText = cr.textInRun.slice(0, matchStart - cr.startInPara);
  const matchText = cr.textInRun.slice(
    matchStart - cr.startInPara,
    matchEnd - cr.startInPara
  );
  const afterText = cr.textInRun.slice(matchEnd - cr.startInPara);

  // Récupère le rPr du run d'origine pour préserver le style.
  const origRunChildren = elChildren(paraChildren[cr.runIdx]);
  const rPr = origRunChildren.find((c) => elName(c) === "w:rPr") ?? null;

  const newNodes: XNode[] = [];
  if (beforeText.length > 0) {
    newNodes.push(buildRun(rPr, beforeText, true));
  }
  if (matchText.length > 0) {
    newNodes.push(buildDel(trackedIds.del, author, dateIso, rPr, matchText));
  }
  if (replacement.length > 0) {
    newNodes.push(buildIns(trackedIds.ins, author, dateIso, rPr, replacement));
  }
  if (afterText.length > 0) {
    newNodes.push(buildRun(rPr, afterText, true));
  }

  // Splice
  paraChildren.splice(cr.runIdx, 1, ...newNodes);
  return true;
}

function maxTrackedIdInTree(tree: XNode[]): number {
  let max = 0;
  const walk = (nodes: XNode[]) => {
    for (const n of nodes) {
      const attrs = elAttrs(n);
      if (attrs && attrs["@_w:id"]) {
        const v = parseInt(attrs["@_w:id"], 10);
        if (Number.isFinite(v) && v > max) max = v;
      }
      const kids = elChildren(n);
      if (kids.length > 0) walk(kids);
    }
  };
  walk(tree);
  return max;
}

/**
 * Pipeline complet : DOCX in, DOCX out (avec tracked changes appliqués).
 */
export async function applyTrackedEdits(
  docxBytes: Buffer,
  edits: EditInput[],
  options?: { author?: string }
): Promise<ApplyResult> {
  const author = options?.author ?? "Louis";
  const dateIso = new Date().toISOString();

  const zip = await JSZip.loadAsync(docxBytes);
  const docXmlEntry =
    zip.file("word/document.xml") ?? zip.file("word\\document.xml");
  if (!docXmlEntry) throw new Error("word/document.xml introuvable dans le DOCX");
  const xmlRaw = await docXmlEntry.async("string");

  const tree = xmlParser.parse(xmlRaw) as XNode[];
  const body = findBody(tree);
  if (!body) throw new Error("<w:body> introuvable dans document.xml");

  // Collecte les paragraphes pour pouvoir les indexer / réécrire.
  type ParaSlot = {
    paraIndex: number;
    children: XNode[];
    setChildren: (c: XNode[]) => void;
  };
  const paragraphs: ParaSlot[] = [];
  forEachParagraph(body, (children, setChildren) => {
    paragraphs.push({
      paraIndex: paragraphs.length,
      children,
      setChildren,
    });
  });

  let nextId = maxTrackedIdInTree(tree) + 1;
  const applied: AppliedEdit[] = [];
  const errors: EditError[] = [];

  edits.forEach((edit, editIndex) => {
    const find = edit.find ?? "";
    const replace = edit.replace ?? "";
    if (!find && !replace) {
      errors.push({
        index: editIndex,
        reason: "empty",
        message: "Edit vide (find et replace tous deux absents).",
      });
      return;
    }
    const ctxBefore = edit.context_before ?? "";
    const ctxAfter = edit.context_after ?? "";

    type Hit = { para: ParaSlot; start: number; end: number };
    const tryStrategy = (cb: string, ca: string): Hit[] | "ambiguous" => {
      const hits: Hit[] = [];
      let ambiguous = false;
      for (const p of paragraphs) {
        const text = flattenRuns(p.children).text;
        const r = locate(text, find, cb, ca);
        if (r.kind === "ambiguous") {
          ambiguous = true;
          break;
        }
        if (r.kind === "ok") hits.push({ para: p, start: r.start, end: r.end });
      }
      if (ambiguous) return "ambiguous";
      return hits;
    };

    // 1) full context, 2) before only, 3) after only, 4) bare (must be globally unique)
    let chosen: Hit[] | null = null;
    for (const [cb, ca] of [
      [ctxBefore, ctxAfter],
      [ctxBefore, ""],
      ["", ctxAfter],
      ["", ""],
    ] as [string, string][]) {
      const r = tryStrategy(cb, ca);
      if (r === "ambiguous") continue;
      if (r.length === 1) {
        chosen = r;
        break;
      }
    }

    if (!chosen) {
      errors.push({
        index: editIndex,
        reason: "not_found",
        message: `« ${find.slice(0, 40)}${find.length > 40 ? "…" : ""} » introuvable ou ambigu.`,
      });
      return;
    }

    const hit = chosen[0];
    const ids = { del: nextId++, ins: nextId++ };
    const ok = spliceParagraph(
      hit.para.children,
      hit.start,
      hit.end,
      replace,
      ids,
      author,
      dateIso
    );
    if (!ok) {
      errors.push({
        index: editIndex,
        reason: "internal",
        message: "Le texte cible traverse plusieurs runs avec styles différents — édition non supportée en v1.",
      });
      return;
    }
    hit.para.setChildren(hit.para.children);
    applied.push({
      index: editIndex,
      find,
      replace,
      reason: edit.reason,
      paragraph: hit.para.paraIndex,
      trackedId: ids.ins,
    });
  });

  // Sérialise et remet dans le zip.
  const newXml = xmlBuilder.build(tree) as string;
  // Préserve le prologue XML d'origine s'il existait.
  const prologue = xmlRaw.match(/^<\?xml[^?]*\?>/)?.[0] ?? "";
  const finalXml = prologue
    ? prologue + (newXml.startsWith("<?xml") ? newXml.replace(/^<\?xml[^?]*\?>/, "") : newXml)
    : newXml;
  // Note pour le namespace : on n'altère pas l'élément racine, juste son
  // contenu — donc xmlns:w est conservé.
  void WORD_NS;

  const path = zip.file("word/document.xml") ? "word/document.xml" : "word\\document.xml";
  zip.file(path, finalXml);

  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  return { buffer, applied, errors };
}

/**
 * Extrait juste le texte du body (utilisé par read_document tool).
 * Concatène tous les w:t avec un \n entre paragraphes.
 */
export async function extractDocxBodyText(docxBytes: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(docxBytes);
  const entry =
    zip.file("word/document.xml") ?? zip.file("word\\document.xml");
  if (!entry) return "";
  const xml = await entry.async("string");
  const tree = xmlParser.parse(xml) as XNode[];
  const body = findBody(tree);
  if (!body) return "";
  const out: string[] = [];
  forEachParagraph(body, (children) => {
    out.push(flattenRuns(children).text);
  });
  return out.filter((s) => s.length > 0).join("\n");
}
