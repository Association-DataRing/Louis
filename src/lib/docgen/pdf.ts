import PDFDocument from "pdfkit";
import {
  parseMarkdownBlocks,
  type Block,
  type InlineRun,
} from "./markdown-blocks";

/**
 * Convertit un titre + un corps Markdown en un Buffer PDF via pdfkit.
 * pdfkit utilise Helvetica intégrée par défaut (Type 1, supporte le
 * latin-1) — pas d'embedding de police custom, le PDF reste léger
 * (~10-30 Ko pour un mémo standard).
 */
export async function generatePdf(
  title: string,
  contentMarkdown: string
): Promise<Buffer> {
  const blocks = parseMarkdownBlocks(contentMarkdown);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 56, bottom: 56, left: 64, right: 56 },
      info: {
        Title: title,
        Author: "Louis",
        Producer: "Louis — IA juridique souveraine",
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Titre
    doc
      .font("Helvetica-Bold")
      .fontSize(20)
      .text(title, { lineGap: 6 })
      .moveDown(1);

    for (const block of blocks) {
      writeBlock(doc, block);
    }

    doc.end();
  });
}

function writeBlock(
  doc: PDFKit.PDFDocument,
  block: Block
): void {
  switch (block.kind) {
    case "heading": {
      const size = block.level === 1 ? 16 : block.level === 2 ? 14 : 12;
      doc.moveDown(0.6).font("Helvetica-Bold").fontSize(size);
      doc.text(block.text, { lineGap: 3 });
      doc.moveDown(0.3);
      return;
    }
    case "paragraph":
      doc.font("Helvetica").fontSize(11);
      writeRuns(doc, block.runs);
      doc.moveDown(0.6);
      return;
    case "list": {
      doc.font("Helvetica").fontSize(11);
      block.items.forEach((item: InlineRun[], i: number) => {
        const prefix = block.ordered ? `${i + 1}. ` : "•  ";
        // Indent : on écrit le préfixe puis continue avec le run sur la
        // même ligne. pdfkit ne gère pas une vraie liste, on simule.
        doc.text(prefix, { continued: true });
        writeRuns(doc, item, { lineGap: 2 });
      });
      doc.moveDown(0.5);
      return;
    }
    case "blockquote":
      doc.moveDown(0.3);
      doc.font("Helvetica-Oblique").fontSize(11);
      const startY = doc.y;
      const startX = doc.x;
      doc.x = startX + 16;
      writeRuns(doc, block.runs);
      doc.x = startX;
      // Barre verticale à gauche du quote
      doc.save();
      doc
        .strokeColor("#888")
        .lineWidth(1.5)
        .moveTo(startX + 4, startY - 2)
        .lineTo(startX + 4, doc.y + 2)
        .stroke()
        .restore();
      doc.moveDown(0.5);
      return;
    case "hr":
      doc.moveDown(0.5);
      doc
        .save()
        .strokeColor("#ccc")
        .lineWidth(0.5)
        .moveTo(doc.x, doc.y)
        .lineTo(doc.page.width - doc.page.margins.right, doc.y)
        .stroke()
        .restore();
      doc.moveDown(0.5);
      return;
  }
}

/**
 * Écrit une suite de runs typés sur la même ligne logique. pdfkit
 * `text(..., { continued: true })` permet de chaîner sans linebreak.
 */
function writeRuns(
  doc: PDFKit.PDFDocument,
  rs: InlineRun[],
  opts: PDFKit.Mixins.TextOptions = {}
): void {
  rs.forEach((r, i) => {
    const isLast = i === rs.length - 1;
    if (r.bold && r.italic) doc.font("Helvetica-BoldOblique");
    else if (r.bold) doc.font("Helvetica-Bold");
    else if (r.italic) doc.font("Helvetica-Oblique");
    else doc.font("Helvetica");
    doc.text(r.text, { ...opts, continued: !isLast });
  });
  // Reset à Helvetica pour le run suivant — sinon le block suivant hérite
  // de la dernière variante stylistique.
  doc.font("Helvetica");
}
