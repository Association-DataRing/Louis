import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  PageNumber,
  PageOrientation,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type ISectionOptions,
} from "docx";
import { parseInline, type InlineRun } from "./markdown-blocks";
import type { Alignment, DocumentSpec, Section } from "./types";

/** Convertit cm en twips (unité Word, 1 cm = 567 twips). */
const cm = (n: number) => Math.round(n * 567);

const ALIGN_MAP: Record<Alignment, (typeof AlignmentType)[keyof typeof AlignmentType]> = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
  justify: AlignmentType.JUSTIFIED,
};

function makeRuns(content: string, font: string): TextRun[] {
  const inline = parseInline(content);
  return inline.map(
    (r: InlineRun) =>
      new TextRun({
        text: r.text,
        bold: r.bold,
        italics: r.italic,
        font,
      })
  );
}

function sectionToDocxChildren(
  section: Section,
  font: string
): (Paragraph | Table)[] {
  switch (section.kind) {
    case "heading": {
      const level =
        section.level === 1
          ? HeadingLevel.HEADING_1
          : section.level === 2
            ? HeadingLevel.HEADING_2
            : section.level === 3
              ? HeadingLevel.HEADING_3
              : HeadingLevel.HEADING_4;
      const size = section.level === 1 ? 36 : section.level === 2 ? 28 : section.level === 3 ? 24 : 22;
      return [
        new Paragraph({
          heading: level,
          alignment: ALIGN_MAP[section.align ?? "left"],
          spacing: { before: 280, after: 140 },
          children: [
            new TextRun({
              text: section.text,
              bold: true,
              font,
              size,
            }),
          ],
        }),
      ];
    }
    case "paragraph":
      return [
        new Paragraph({
          alignment: ALIGN_MAP[section.align ?? "justify"],
          spacing: { after: 200, line: 320 },
          // Quand le paragraphe entier est marqué bold/italic, on applique
          // ces drapeaux à tous les runs ; sinon makeRuns() préserve les
          // **gras** / _italiques_ inline du markdown.
          children:
            section.bold || section.italic
              ? parseInline(section.content).map(
                  (r: InlineRun) =>
                    new TextRun({
                      text: r.text,
                      bold: r.bold || section.bold,
                      italics: r.italic || section.italic,
                      font,
                    })
                )
              : makeRuns(section.content, font),
        }),
      ];
    case "list":
      return section.items.map((item) => {
        const level = Math.min(Math.max(item.level, 0), 4);
        return new Paragraph({
          numbering: section.ordered
            ? { reference: "ordered", level }
            : undefined,
          bullet: section.ordered ? undefined : { level },
          spacing: { after: 80 },
          children: makeRuns(item.text, font),
        });
      });
    case "blockquote":
      return [
        new Paragraph({
          indent: { left: cm(1) },
          spacing: { before: 120, after: 120 },
          children: parseInline(section.content).map(
            (r: InlineRun) =>
              new TextRun({
                text: r.text,
                bold: r.bold,
                italics: true, // forcé pour le quote
                font,
              })
          ),
        }),
      ];
    case "table": {
      const lightBorder = {
        top: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
        left: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
        right: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" },
      };
      const headerRow = new TableRow({
        tableHeader: true,
        children: section.headers.map(
          (h) =>
            new TableCell({
              borders: lightBorder,
              shading: { fill: "F4F4F6" },
              children: [
                new Paragraph({
                  spacing: { before: 60, after: 60 },
                  children: [
                    new TextRun({ text: h, bold: true, font, size: 20 }),
                  ],
                }),
              ],
            })
        ),
      });
      const bodyRows = section.rows.map(
        (row) =>
          new TableRow({
            children: row.map(
              (cell) =>
                new TableCell({
                  borders: lightBorder,
                  children: [
                    new Paragraph({
                      spacing: { before: 60, after: 60 },
                      children: parseInline(cell).map(
                        (r: InlineRun) =>
                          new TextRun({
                            text: r.text,
                            bold: r.bold,
                            italics: r.italic,
                            font,
                            size: 20,
                          })
                      ),
                    }),
                  ],
                })
            ),
          })
      );
      const out: (Paragraph | Table)[] = [
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [headerRow, ...bodyRows],
        }),
      ];
      if (section.caption) {
        out.push(
          new Paragraph({
            spacing: { before: 80, after: 200 },
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: section.caption,
                italics: true,
                font,
                size: 18,
                color: "666666",
              }),
            ],
          })
        );
      } else {
        out.push(new Paragraph({ spacing: { after: 200 }, children: [] }));
      }
      return out;
    }
    case "pageBreak":
      return [new Paragraph({ children: [], pageBreakBefore: true })];
    case "hr":
      return [
        new Paragraph({
          spacing: { before: 200, after: 200 },
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "_______________", font })],
        }),
      ];
    case "spacer":
      return Array.from({ length: section.lines ?? 1 }, () =>
        new Paragraph({ children: [] })
      );
  }
}

/**
 * Génère un .docx structuré. Marges 2.5 cm, justification par défaut,
 * footer "Page X / Y" optionnel, support landscape, tables avec en-têtes
 * grisés et bordures fines, page breaks explicites.
 */
export async function generateDocx(spec: DocumentSpec): Promise<Buffer> {
  const font =
    spec.fontFamily === "sans" ? "Calibri" : "Cambria"; // serif legal-friendly par défaut
  const margins = {
    top: cm(spec.margins?.top ?? 2.5),
    bottom: cm(spec.margins?.bottom ?? 2.5),
    left: cm(spec.margins?.left ?? 2.5),
    right: cm(spec.margins?.right ?? 2.5),
  };

  const titleParagraphs: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { after: spec.subtitle ? 80 : 360 },
      children: [
        new TextRun({
          text: spec.title,
          bold: true,
          font,
          size: 44, // 22pt
        }),
      ],
    }),
  ];
  if (spec.subtitle) {
    titleParagraphs.push(
      new Paragraph({
        spacing: { after: 360 },
        children: [
          new TextRun({
            text: spec.subtitle,
            italics: true,
            font,
            size: 24,
            color: "666666",
          }),
        ],
      })
    );
  }

  const bodyChildren = spec.sections.flatMap((s) =>
    sectionToDocxChildren(s, font)
  );

  // Footer : page numbers + texte custom optionnel.
  const wantsPageNumbers = spec.pageNumbers !== false;
  let footer: Footer | undefined;
  if (wantsPageNumbers || spec.footer) {
    const footerRuns: TextRun[] = [];
    if (spec.footer) {
      footerRuns.push(
        new TextRun({ text: spec.footer + "  ·  ", font, size: 16, color: "888888" })
      );
    }
    if (wantsPageNumbers) {
      footerRuns.push(
        new TextRun({ children: ["Page ", PageNumber.CURRENT], font, size: 16, color: "888888" }),
        new TextRun({ children: [" / ", PageNumber.TOTAL_PAGES], font, size: 16, color: "888888" })
      );
    }
    footer = new Footer({
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: footerRuns,
        }),
      ],
    });
  }

  const sectionOpts: ISectionOptions = {
    properties: {
      page: {
        margin: margins,
        size: spec.landscape
          ? { orientation: PageOrientation.LANDSCAPE }
          : { orientation: PageOrientation.PORTRAIT },
      },
    },
    footers: footer ? { default: footer } : undefined,
    children: [...titleParagraphs, ...bodyChildren],
  };

  const doc = new Document({
    creator: "Louis",
    title: spec.title,
    description: "Document généré par Louis — IA juridique souveraine",
    styles: {
      default: {
        document: { run: { font, size: 22 } },
      },
    },
    numbering: {
      config: [
        {
          reference: "ordered",
          // Niveaux d'imbrication 0–4 (1. → a. → i. → 1. → a.), pour rendre les
          // clauses multi-niveaux d'un acte au lieu de les aplatir.
          levels: [
            { level: 0, format: "decimal", text: "%1.", alignment: AlignmentType.LEFT },
            { level: 1, format: "lowerLetter", text: "%2.", alignment: AlignmentType.LEFT },
            { level: 2, format: "lowerRoman", text: "%3.", alignment: AlignmentType.LEFT },
            { level: 3, format: "decimal", text: "%4.", alignment: AlignmentType.LEFT },
            { level: 4, format: "lowerLetter", text: "%5.", alignment: AlignmentType.LEFT },
          ],
        },
      ],
    },
    sections: [sectionOpts],
  });

  return Packer.toBuffer(doc);
}
