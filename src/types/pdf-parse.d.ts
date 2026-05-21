declare module "pdf-parse/lib/pdf-parse.js" {
  type PDFParseResult = { text: string; numpages: number; info: unknown };
  const pdfParse: (data: Buffer | Uint8Array) => Promise<PDFParseResult>;
  export default pdfParse;
}
