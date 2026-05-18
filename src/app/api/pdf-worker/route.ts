import { promises as fs } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { auth } from "@/auth";

/**
 * Sert le worker pdfjs depuis node_modules — évite le besoin de copier
 * le fichier dans /public via un postinstall, et conserve la souveraineté
 * (zéro dépendance CDN).
 *
 * On résout le worker en partant de react-pdf pour toujours servir la
 * version exacte que le client embarque, que pdfjs-dist soit imbriqué
 * (nested) ou hoisté au top-level par npm. Sinon, mismatch worker/API
 * → « API version X does not match Worker version Y ».
 *
 * On ancre `createRequire` sur le package.json du projet (et non
 * `import.meta.url`) parce que Turbopack bundle la route dans
 * `.next/dev/...` — depuis ce chemin, la résolution Node ne retrouve
 * pas toujours `node_modules`.
 */
const projectRequire = createRequire(
  pathToFileURL(path.join(process.cwd(), "package.json"))
);

function resolveWorkerPath(): string {
  const reactPdfPkg = projectRequire.resolve("react-pdf/package.json");
  return projectRequire.resolve("pdfjs-dist/build/pdf.worker.min.mjs", {
    paths: [reactPdfPkg],
  });
}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  let file: Buffer;
  try {
    file = await fs.readFile(resolveWorkerPath());
  } catch (err) {
    console.error("[pdf-worker] resolve/read failed:", err);
    return new Response("Worker introuvable", { status: 500 });
  }

  return new Response(new Uint8Array(file) as BodyInit, {
    headers: {
      "Content-Type": "text/javascript",
      // no-store en dev pour que les changements de path de worker ne
      // soient pas masqués par un cache navigateur. En prod on peut
      // remettre un long max-age + cache-bust via query string.
      "Cache-Control": "no-store",
    },
  });
}
