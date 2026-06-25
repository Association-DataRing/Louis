/**
 * Rastérisation des pages d'un PDF en images PNG, via pdfjs + @napi-rs/canvas.
 * Partagé par les moteurs OCR qui travaillent sur des images : Tesseract local
 * (cf. tesseract.ts) et OCR par modèle de vision (cf. vision-llm.ts).
 */

const RASTER_SCALE = 2; // 2× → ~150–200 DPI : bon compromis qualité OCR / temps
const MAX_PAGES = 50; // garde-fou : l'OCR par image est coûteux, on borne

export type RasterOptions = { maxPages?: number; scale?: number };

/** Rastérise les pages d'un PDF en buffers PNG. */
export async function rasterizePdf(
  buffer: Buffer,
  { maxPages = MAX_PAGES, scale = RASTER_SCALE }: RasterOptions = {}
): Promise<Buffer[]> {
  const canvasMod = await import("@napi-rs/canvas");
  const { createCanvas } = canvasMod;

  // pdfjs construit des Path2D/DOMMatrix au rendu ; sans ces globals il utilise
  // des classes incompatibles avec le contexte @napi-rs/canvas (ctx.clip lève
  // « Value is none of these types String, Path »). On les aligne AVANT
  // d'importer pdfjs pour qu'ils partagent les mêmes implémentations.
  const g = globalThis as unknown as Record<string, unknown>;
  g.DOMMatrix ??= canvasMod.DOMMatrix;
  g.Path2D ??= canvasMod.Path2D;
  g.ImageData ??= canvasMod.ImageData;

  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    isEvalSupported: false,
    useSystemFonts: true,
  }).promise;

  const pages: Buffer[] = [];
  try {
    const count = Math.min(doc.numPages, maxPages);
    for (let p = 1; p <= count; p++) {
      const page = await doc.getPage(p);
      const viewport = page.getViewport({ scale });
      const canvas = createCanvas(
        Math.ceil(viewport.width),
        Math.ceil(viewport.height)
      );
      const ctx = canvas.getContext("2d");
      await page.render({
        // @napi-rs/canvas implémente l'API Canvas standard attendue par pdfjs.
        canvasContext: ctx as unknown as CanvasRenderingContext2D,
        viewport,
        canvas: canvas as unknown as HTMLCanvasElement,
      }).promise;
      pages.push(canvas.toBuffer("image/png"));
      page.cleanup();
    }
  } finally {
    await doc.destroy();
  }
  return pages;
}
