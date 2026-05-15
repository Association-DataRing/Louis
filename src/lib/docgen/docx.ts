import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import {
  parseMarkdownBlocks,
  type Block,
  type InlineRun,
} from "./markdown-blocks";

const FONT = "Cambria"; // serif présent par défaut sur Word/Pages, ton « juridique »

function runs(rs: InlineRun[]): TextRun[] {
  return rs.map(
    (r) =>
      new TextRun({
        text: r.text,
        bold: r.bold,
        italics: r.italic,
        font: FONT,
      })
  );
}

function blockToParagraphs(block: Block): Paragraph[] {
  switch (block.kind) {
    case "heading": {
      const level =
        block.level === 1
          ? HeadingLevel.HEADING_1
          : block.level === 2
            ? HeadingLevel.HEADING_2
            : HeadingLevel.HEADING_3;
      return [
        new Paragraph({
          heading: level,
          spacing: { before: 240, after: 120 },
          children: [
            new TextRun({
              text: block.text,
              bold: true,
              font: FONT,
              size: block.level === 1 ? 36 : block.level === 2 ? 28 : 24,
            }),
          ],
        }),
      ];
    }
    case "paragraph":
      return [
        new Paragraph({
          spacing: { after: 200, line: 320 },
          children: runs(block.runs),
        }),
      ];
    case "list":
      return block.items.map(
        (item: InlineRun[]) =>
          new Paragraph({
            numbering: block.ordered
              ? { reference: "ordered", level: 0 }
              : undefined,
            bullet: block.ordered ? undefined : { level: 0 },
            spacing: { after: 80 },
            children: runs(item),
          })
      );
    case "blockquote":
      return [
        new Paragraph({
          indent: { left: 480 },
          spacing: { before: 120, after: 120 },
          children: block.runs.map(
            (r: InlineRun) =>
              new TextRun({
                text: r.text,
                bold: r.bold,
                italics: true, // forçé pour le quote
                font: FONT,
              })
          ),
        }),
      ];
    case "hr":
      return [
        new Paragraph({
          spacing: { before: 200, after: 200 },
          children: [new TextRun({ text: "_______________", font: FONT })],
          alignment: AlignmentType.CENTER,
        }),
      ];
    default:
      return [];
  }
}

/**
 * Convertit un titre + un corps Markdown en un Buffer .docx prêt à
 * télécharger. Utilise Cambria comme police par défaut (présente sur
 * toutes les versions de Word/Pages, ton sobre).
 */
export async function generateDocx(
  title: string,
  contentMarkdown: string
): Promise<Buffer> {
  const blocks = parseMarkdownBlocks(contentMarkdown);

  const doc = new Document({
    creator: "Louis",
    title,
    description: "Document généré par Louis — IA juridique souveraine",
    styles: {
      default: {
        document: {
          run: { font: FONT, size: 22 }, // 11pt
        },
      },
    },
    numbering: {
      config: [
        {
          reference: "ordered",
          levels: [
            {
              level: 0,
              format: "decimal",
              text: "%1.",
              alignment: AlignmentType.LEFT,
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1134, // ~2cm
              bottom: 1134,
              left: 1418, // ~2.5cm
              right: 1134,
            },
          },
        },
        children: [
          new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { after: 480 },
            children: [
              new TextRun({
                text: title,
                bold: true,
                font: FONT,
                size: 40, // 20pt
              }),
            ],
          }),
          ...blocks.flatMap(blockToParagraphs),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}
