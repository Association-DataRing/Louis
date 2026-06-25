/**
 * Conversion locale, souveraine et gratuite d'un PDF à couche texte en
 * Markdown structuré. AUCUN appel externe : tout se passe en mémoire serveur
 * via pdfjs (déjà présent comme dépendance de react-pdf).
 *
 * On reconstruit la structure logique à partir de la géométrie des glyphes :
 * - la TAILLE DE POLICE distingue les titres du corps de texte ;
 * - la POSITION VERTICALE regroupe les fragments en lignes puis en paragraphes ;
 * - une LIGNE COURTE (qui s'arrête avant la marge droite) marque une fin de
 *   paragraphe — le signal le plus fiable pour séparer un retour à la ligne
 *   d'un vrai saut de paragraphe dans les actes juridiques single-spaced.
 *
 * Limites assumées : tableaux complexes et multi-colonnes ne sont pas
 * reconstruits fidèlement (dégradation en texte lisible). Pour ces cas, le
 * DocPanel garde l'aperçu PDF fidèle, et l'OCR (cf. lib/ocr) produit un
 * Markdown de meilleure qualité sur les mises en page riches.
 *
 * pdfjs v5 référence DOMMatrix/Path2D au chargement du module : `@napi-rs/canvas`
 * fournit ces globals côté Node (et sert aussi à rasteriser les pages pour
 * l'OCR Tesseract — cf. lib/ocr/tesseract.ts).
 */

// Ratios de taille de police (relativement au corps) pour classer les titres.
const HEADING_H1 = 1.5;
const HEADING_H2 = 1.25;
const HEADING_H3 = 1.1;
// Un écart vertical supérieur à ce multiple de la taille du corps marque un
// saut de paragraphe, même entre deux lignes pleines.
const PARA_GAP_RATIO = 1.7;

type Line = {
  text: string;
  /** Bord gauche (x du premier fragment). */
  left: number;
  /** Bord droit (x + largeur du dernier fragment). */
  right: number;
  /** Position verticale (origine PDF, croissante vers le haut). */
  y: number;
  /** Plus grande taille de police de la ligne (détection des titres). */
  size: number;
};

/** Fragment de texte renvoyé par pdfjs (sous-ensemble typé de TextItem). */
type RawItem = {
  str: string;
  /** Matrice [a, b, c, d, e, f] : d ≈ taille, e = x, f = y. */
  transform: number[];
  width?: number;
};

/**
 * Regroupe les fragments d'une page en lignes ordonnées (haut → bas),
 * fragments triés par x et joints en insérant une espace quand un écart
 * horizontal le justifie.
 */
function buildLines(items: RawItem[]): Line[] {
  const raw = items.filter((i) => typeof i.str === "string" && i.str.trim() !== "");
  const groups: { y: number; parts: RawItem[] }[] = [];

  for (const it of raw) {
    const size = Math.abs(it.transform[3]) || Math.abs(it.transform[0]) || 10;
    const y = it.transform[5];
    // Tolérance verticale = demi-hauteur de glyphe : absorbe les micro-écarts
    // de baseline sans fusionner deux lignes distinctes.
    let group = groups.find((g) => Math.abs(g.y - y) <= Math.max(2, size * 0.5));
    if (!group) {
      group = { y, parts: [] };
      groups.push(group);
    }
    group.parts.push(it);
  }

  groups.sort((a, b) => b.y - a.y);

  return groups
    .map((g) => {
      g.parts.sort((a, b) => a.transform[4] - b.transform[4]);
      let text = "";
      let prevRight: number | null = null;
      let size = 0;
      for (const p of g.parts) {
        const x = p.transform[4];
        const psize = Math.abs(p.transform[3]) || Math.abs(p.transform[0]) || 10;
        if (prevRight !== null) {
          const gap = x - prevRight;
          if (gap > psize * 0.2 && !text.endsWith(" ") && !p.str.startsWith(" ")) {
            text += " ";
          }
        }
        text += p.str;
        prevRight = x + (p.width ?? 0);
        if (psize > size) size = psize;
      }
      return {
        text: text.replace(/\s+/g, " ").trim(),
        left: g.parts[0].transform[4],
        right: prevRight ?? 0,
        y: g.y,
        size,
      };
    })
    .filter((l) => l.text.length > 0);
}

/**
 * Taille du corps de texte = taille de police portant le plus de caractères
 * (pondération par longueur → robuste face à un titre isolé très gros).
 */
function bodySize(lines: Line[]): number {
  const weight = new Map<number, number>();
  for (const l of lines) {
    const k = Math.round(l.size);
    weight.set(k, (weight.get(k) ?? 0) + l.text.length);
  }
  let best = 10;
  let max = 0;
  for (const [k, w] of weight) {
    if (w > max) {
      max = w;
      best = k;
    }
  }
  return best || 10;
}

type LineKind =
  | { type: "h"; level: 1 | 2 | 3 }
  | { type: "ul" }
  | { type: "ol" }
  | { type: "p" };

function classify(line: Line, body: number): LineKind {
  const ratio = line.size / body;
  if (ratio >= HEADING_H1) return { type: "h", level: 1 };
  if (ratio >= HEADING_H2) return { type: "h", level: 2 };
  if (ratio >= HEADING_H3) return { type: "h", level: 3 };
  if (/^[•‣▪◦·]\s+/.test(line.text) || /^[-–*]\s+/.test(line.text)) {
    return { type: "ul" };
  }
  if (/^\d{1,2}[.)]\s+/.test(line.text)) return { type: "ol" };
  return { type: "p" };
}

function renderPage(lines: Line[], body: number, blocks: string[]): void {
  // Marge droite de la page = ligne la plus longue. Une ligne s'arrêtant bien
  // avant cette marge a « fini tôt » → fin de paragraphe.
  const maxRight = lines.reduce((m, l) => Math.max(m, l.right), 0);
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push(para.join(" "));
    para = [];
  };

  let prevY: number | null = null;
  for (const line of lines) {
    const gap = prevY === null ? 0 : prevY - line.y;
    prevY = line.y;
    const kind = classify(line, body);

    if (kind.type !== "p" || (gap > body * PARA_GAP_RATIO && para.length)) {
      flush();
    }

    if (kind.type === "h") {
      blocks.push("#".repeat(kind.level) + " " + line.text);
    } else if (kind.type === "ul") {
      blocks.push("- " + line.text.replace(/^[•‣▪◦·\-–*]\s+/, ""));
    } else if (kind.type === "ol") {
      blocks.push(line.text.replace(/^(\d{1,2})[.)]\s+/, "$1. "));
    } else {
      para.push(line.text);
      // Ligne courte = dernière ligne de son paragraphe.
      const isFull = line.right >= maxRight - body;
      if (!isFull) flush();
    }
  }
  flush();
}

/**
 * Convertit un PDF (Buffer) en Markdown. Renvoie une chaîne vide si le PDF
 * n'a aucune couche texte exploitable (scanné) — l'appelant décide alors de
 * basculer vers l'OCR.
 */
export async function pdfToMarkdown(buffer: Buffer): Promise<string> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    isEvalSupported: false,
    useSystemFonts: true,
  }).promise;

  const blocks: string[] = [];
  const pages: Line[][] = [];

  try {
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      pages.push(buildLines(content.items as RawItem[]));
      page.cleanup();
    }
  } finally {
    await doc.destroy();
  }

  const body = bodySize(pages.flat());
  for (const lines of pages) {
    renderPage(lines, body, blocks);
  }

  return blocks
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
