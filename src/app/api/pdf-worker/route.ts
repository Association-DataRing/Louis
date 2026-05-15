import { promises as fs } from "node:fs";
import path from "node:path";
import { auth } from "@/auth";

/**
 * Sert le worker pdfjs depuis node_modules — évite le besoin de copier
 * le fichier dans /public via un postinstall, et conserve la souveraineté
 * (zéro dépendance CDN).
 *
 * Crucial : on lit le worker de la sub-dépendance de react-pdf
 * (node_modules/react-pdf/node_modules/pdfjs-dist) et non du pdfjs-dist
 * top-level. Sans ça, mismatch entre la version JS embarquée par
 * react-pdf (ex. 5.4.296) et celle qu'on a installée pour parser des
 * PDF côté serveur (ex. 5.7.284) → erreur runtime « API version X
 * does not match Worker version Y ».
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const workerPath = path.join(
    process.cwd(),
    "node_modules/react-pdf/node_modules/pdfjs-dist/build/pdf.worker.min.mjs"
  );

  let file: Buffer;
  try {
    file = await fs.readFile(workerPath);
  } catch {
    return new Response("Worker introuvable", { status: 500 });
  }

  return new Response(new Uint8Array(file) as BodyInit, {
    headers: {
      "Content-Type": "text/javascript",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
