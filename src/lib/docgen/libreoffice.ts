/**
 * Conversion DOCX → PDF pour la preview fidèle (rendu identique à Word).
 *
 * Deux stratégies, en cascade :
 *
 *   1. Gotenberg (recommandé) — service HTTP léger qui wrap LibreOffice
 *      headless. Marche identique en dev (Docker compose) et prod, pas
 *      d'install sur la machine hôte. Activé en posant
 *      `GOTENBERG_URL=http://localhost:3001` (port par défaut du
 *      container `gotenberg/gotenberg:8`).
 *
 *   2. LibreOffice local — binaire `soffice` accessible directement par
 *      le process Node (via `libreoffice-convert` npm). Demande
 *      l'installation système (`brew install --cask libreoffice` sur
 *      Mac, `apt install libreoffice` sur Debian). Plus rapide qu'un
 *      appel HTTP mais alourdit l'env de dev.
 *
 * Si aucune stratégie n'est utilisable, retourne null — le DocPanel
 * retombe sur la preview HTML mammoth (lisible mais moins fidèle).
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
  | ((
      buffer: Buffer,
      format: string,
      filter: string | undefined
    ) => Promise<Buffer>)
  | null = null;

async function getLocalConvert() {
  if (convertFn) return convertFn;
  const mod = (await import("libreoffice-convert")) as unknown as {
    default: LibreModule;
  };
  convertFn = promisify(mod.default.convert.bind(mod.default));
  return convertFn;
}

async function convertViaGotenberg(buffer: Buffer): Promise<Buffer | null> {
  const baseUrl = process.env.GOTENBERG_URL;
  if (!baseUrl) return null;

  // Gotenberg attend un multipart/form-data avec le champ "files" et un
  // filename qui se termine par .docx pour router vers son LibreOffice
  // interne.
  const form = new FormData();
  const blob = new Blob([new Uint8Array(buffer)], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  form.append("files", blob, "document.docx");

  const url = baseUrl.replace(/\/$/, "") + "/forms/libreoffice/convert";
  const res = await fetch(url, { method: "POST", body: form });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Gotenberg ${res.status} : ${text.slice(0, 200) || res.statusText}`
    );
  }
  const arr = await res.arrayBuffer();
  return Buffer.from(arr);
}

async function convertLocally(buffer: Buffer): Promise<Buffer | null> {
  const convert = await getLocalConvert();
  return convert(buffer, ".pdf", undefined);
}

/**
 * Convertit un buffer DOCX en PDF. Retourne null si aucune stratégie n'est
 * disponible ou si toutes échouent.
 */
export async function docxToPdf(buffer: Buffer): Promise<Buffer | null> {
  // Stratégie 1 : Gotenberg si configuré (priorité — marche identique
  // dans tous les environnements).
  if (process.env.GOTENBERG_URL) {
    try {
      return await convertViaGotenberg(buffer);
    } catch (err) {
      console.warn(
        "[docgen] Gotenberg a échoué, tentative LibreOffice local :",
        err instanceof Error ? err.message : err
      );
    }
  }

  // Stratégie 2 : binaire soffice local.
  try {
    return await convertLocally(buffer);
  } catch (err) {
    console.warn(
      "[docgen] LibreOffice local indisponible — preview HTML fallback.\n" +
        "  → macOS : brew install --cask libreoffice\n" +
        "  → Debian/Ubuntu : apt install libreoffice\n" +
        "  → Ou activer Gotenberg : GOTENBERG_URL=http://localhost:3001\n" +
        "  Détail erreur :",
      err instanceof Error ? err.message : err
    );
    return null;
  }
}
