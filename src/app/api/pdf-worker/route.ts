import { promises as fs } from "node:fs";
import path from "node:path";
import { auth } from "@/auth";

/**
 * Sert le worker pdfjs depuis node_modules — évite le besoin de copier
 * le fichier dans /public via un postinstall, et conserve la souveraineté
 * (zéro dépendance CDN). Authentification simple pour pas servir le
 * worker à des visiteurs anonymes.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const workerPath = path.join(
    process.cwd(),
    "node_modules/pdfjs-dist/build/pdf.worker.min.mjs"
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
