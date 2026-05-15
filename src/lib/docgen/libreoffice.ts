/**
 * Conversion DOCX → PDF via LibreOffice (rendering identique à Word).
 *
 * Utilisé pour la preview fidèle dans le DocPanel : on génère le DOCX
 * comme avant (modifiable), et en parallèle un PDF qui sera affiché en
 * iframe — Word, Pages et LibreOffice utilisent tous le même moteur de
 * rendu sous le capot pour les styles, donc le PDF preview ressemble à
 * ce que l'utilisateur verra à l'ouverture dans Word.
 *
 * LibreOffice doit être installé sur le serveur :
 *   - Linux : apt install libreoffice ou apk add libreoffice
 *   - macOS dev : brew install --cask libreoffice
 *   - Docker : voir Dockerfile.dev
 * Si absent, la conversion échoue silencieusement et on retombe sur la
 * preview HTML mammoth (moins fidèle mais utilisable).
 */
import { promisify } from "util";

type LibreModule = {
  convert: (
    buffer: Buffer,
    format: string,
    filter: string | undefined,
    callback: (err: Error | null, result: Buffer) => void
  ) => void;
};

let convertFn:
  | ((buffer: Buffer, format: string, filter: string | undefined) => Promise<Buffer>)
  | null = null;

async function getConvert() {
  if (convertFn) return convertFn;
  const mod = (await import("libreoffice-convert")) as unknown as {
    default: LibreModule;
  };
  convertFn = promisify(mod.default.convert.bind(mod.default));
  return convertFn;
}

/**
 * Convertit un buffer DOCX en PDF. Retourne null si LibreOffice n'est pas
 * disponible OU si la conversion échoue — l'appelant fait son fallback.
 */
export async function docxToPdf(buffer: Buffer): Promise<Buffer | null> {
  try {
    const convert = await getConvert();
    return await convert(buffer, ".pdf", undefined);
  } catch (err) {
    console.warn(
      "[docgen] LibreOffice indisponible — preview HTML fallback :",
      err instanceof Error ? err.message : err
    );
    return null;
  }
}
