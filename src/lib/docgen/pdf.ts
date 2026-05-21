import PDFDocument from "pdfkit";
import { parseInline, type InlineRun } from "./markdown-blocks";
import type { Alignment, DocumentSpec, Section } from "./types";

/**
 * Génère un PDF structuré via pdfkit. Tables custom (pdfkit n'a pas de
 * primitive table), footer "Page X / Y" via pageAdded event, headers /
 * paragraphes / blockquotes / lists / hr / pageBreaks. Marges A4 par
 * défaut, justified par défaut.
 */
export async function generatePdf(spec: DocumentSpec): Promise<Buffer> {
  // pdfkit n'embed pas de polices custom : on reste sur les Type 1 standard
  // (Helvetica, Times-Roman) intégrées dans tout reader PDF.
  const isSerif = spec.fontFamily !== "sans";
  const FONTS = isSerif
    ? {
        regular: "Times-Roman",
        bold: "Times-Bold",
        italic: "Times-Italic",
        boldItalic: "Times-BoldItalic",
      }
    : {
        regular: "Helvetica",
        bold: "Helvetica-Bold",
        italic: "Helvetica-Oblique",
        boldItalic: "Helvetica-BoldOblique",
      };

  // 1 cm ≈ 28.346 points (PDF unit).
  const cm = (n: number) => Math.round(n * 28.346);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      layout: spec.landscape ? "landscape" : "portrait",
      margins: {
        top: cm(spec.margins?.top ?? 2.5),
        bottom: cm(spec.margins?.bottom ?? 2.5),
        left: cm(spec.margins?.left ?? 2.5),
        right: cm(spec.margins?.right ?? 2.5),
      },
      info: {
        Title: spec.title,
        Author: "Louis",
        Producer: "Louis — IA juridique souveraine",
      },
      bufferPages: true, // requis pour numérotation X / Y en post-traitement
    });

    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Titre
    doc
      .font(FONTS.bold)
      .fontSize(22)
      .text(spec.title, { align: "left", lineGap: 6 });
    if (spec.subtitle) {
      doc
        .moveDown(0.2)
        .font(FONTS.italic)
        .fontSize(12)
        .fillColor("#666")
        .text(spec.subtitle)
        .fillColor("black");
    }
    doc.moveDown(1.2);

    for (const section of spec.sections) {
      writeSection(doc, section, FONTS);
    }

    // Footer + page numbers en post-pass (bufferPages activé)
    const wantsPageNumbers = spec.pageNumbers !== false;
    if (wantsPageNumbers || spec.footer) {
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        const bottomY = doc.page.height - cm(1.2);
        doc.font(FONTS.regular).fontSize(8).fillColor("#888");
        const parts: string[] = [];
        if (spec.footer) parts.push(spec.footer);
        if (wantsPageNumbers)
          parts.push(`Page ${i - range.start + 1} / ${range.count}`);
        doc.text(parts.join("  ·  "), cm(1), bottomY, {
          width: doc.page.width - cm(2),
          align: "center",
          lineBreak: false,
        });
      }
      doc.fillColor("black");
    }

    doc.end();
  });
}

type FontSet = {
  regular: string;
  bold: string;
  italic: string;
  boldItalic: string;
};

function alignFor(a: Alignment | undefined): "left" | "center" | "right" | "justify" {
  return a ?? "justify";
}

function writeSection(
  doc: PDFKit.PDFDocument,
  section: Section,
  fonts: FontSet
): void {
  switch (section.kind) {
    case "heading": {
      const size =
        section.level === 1
          ? 18
          : section.level === 2
            ? 15
            : section.level === 3
              ? 13
              : 12;
      doc.moveDown(0.6).font(fonts.bold).fontSize(size).fillColor("black");
      doc.text(section.text, {
        align: section.align ?? "left",
        lineGap: 3,
      });
      doc.moveDown(0.3);
      return;
    }
    case "paragraph":
      doc
        .font(
          section.bold && section.italic
            ? fonts.boldItalic
            : section.bold
              ? fonts.bold
              : section.italic
                ? fonts.italic
                : fonts.regular
        )
        .fontSize(11)
        .fillColor("black");
      writeInline(doc, parseInline(section.content), fonts, {
        align: alignFor(section.align),
      });
      doc.moveDown(0.6);
      return;
    case "list":
      doc.font(fonts.regular).fontSize(11).fillColor("black");
      section.items.forEach((item, i) => {
        const prefix = section.ordered ? `${i + 1}. ` : "•  ";
        doc.text(prefix, { continued: true });
        writeInline(doc, parseInline(item), fonts, { lineGap: 2 });
      });
      doc.moveDown(0.5);
      return;
    case "blockquote": {
      doc.moveDown(0.3);
      doc.font(fonts.italic).fontSize(11).fillColor("#333");
      const startY = doc.y;
      const startX = doc.x;
      doc.x = startX + 16;
      writeInline(doc, parseInline(section.content), fonts, { italicDefault: true });
      doc.x = startX;
      doc
        .save()
        .strokeColor("#888")
        .lineWidth(1.5)
        .moveTo(startX + 4, startY - 2)
        .lineTo(startX + 4, doc.y + 2)
        .stroke()
        .restore();
      doc.fillColor("black").moveDown(0.5);
      return;
    }
    case "table": {
      drawTable(doc, section.headers, section.rows, fonts);
      if (section.caption) {
        doc
          .moveDown(0.3)
          .font(fonts.italic)
          .fontSize(9)
          .fillColor("#666")
          .text(section.caption, { align: "center" })
          .fillColor("black");
      }
      doc.moveDown(0.6);
      return;
    }
    case "pageBreak":
      doc.addPage();
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
    case "spacer":
      doc.moveDown(section.lines ?? 1);
      return;
  }
}

function writeInline(
  doc: PDFKit.PDFDocument,
  runs: InlineRun[],
  fonts: FontSet,
  opts: PDFKit.Mixins.TextOptions & { italicDefault?: boolean } = {}
): void {
  const { italicDefault, ...textOpts } = opts;
  runs.forEach((r, i) => {
    const isLast = i === runs.length - 1;
    const useBold = r.bold;
    const useItalic = r.italic || italicDefault;
    if (useBold && useItalic) doc.font(fonts.boldItalic);
    else if (useBold) doc.font(fonts.bold);
    else if (useItalic) doc.font(fonts.italic);
    else doc.font(italicDefault ? fonts.italic : fonts.regular);
    doc.text(r.text, { ...textOpts, continued: !isLast });
  });
  doc.font(fonts.regular);
}

/**
 * Tableau dessiné à la main (pdfkit n'a pas de primitive). Largeur de colonne
 * équirépartie, header gris, bordures fines. Pas de support multi-page de la
 * même cellule — pour des tableaux qui dépassent, faire plusieurs `table`
 * sections.
 */
function drawTable(
  doc: PDFKit.PDFDocument,
  headers: string[],
  rows: string[][],
  fonts: FontSet
): void {
  const usableWidth =
    doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const colCount = Math.max(headers.length, ...rows.map((r) => r.length));
  if (colCount === 0) return;
  const colWidth = usableWidth / colCount;
  const padding = 6;

  const startX = doc.x;
  let y = doc.y;

  function rowHeight(cells: string[], font: string): number {
    doc.font(font).fontSize(10);
    let max = 0;
    cells.forEach((cell, i) => {
      const w = colWidth - padding * 2;
      const h =
        doc.heightOfString(cell, { width: w, lineGap: 1 }) + padding * 2;
      if (h > max) max = h;
      void i;
    });
    return max;
  }

  function drawRow(cells: string[], font: string, fillBg: string | null): void {
    const h = rowHeight(cells, font);
    if (y + h > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      y = doc.y;
    }
    cells.forEach((cell, i) => {
      const x = startX + i * colWidth;
      if (fillBg) {
        doc.save().rect(x, y, colWidth, h).fill(fillBg).restore();
      }
      doc
        .save()
        .strokeColor("#bbb")
        .lineWidth(0.5)
        .rect(x, y, colWidth, h)
        .stroke()
        .restore();
      doc
        .font(font)
        .fontSize(10)
        .fillColor("black")
        .text(cell, x + padding, y + padding, {
          width: colWidth - padding * 2,
          lineGap: 1,
        });
    });
    y += h;
  }

  drawRow(headers, fonts.bold, "#F4F4F6");
  for (const row of rows) {
    drawRow(row, fonts.regular, null);
  }
  doc.x = startX;
  doc.y = y;
}
