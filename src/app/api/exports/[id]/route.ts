import { auth } from "@/auth";
import { getExport } from "@/lib/docgen";

/**
 * Sert un document généré (DOCX/PDF) à partir de son ID éphémère.
 *
 * Les exports vivent 10 min en mémoire serveur — assez pour qu'un avocat
 * clique sur le lien, pas assez pour qu'une URL leakée reste exploitable
 * indéfiniment. Vérification d'identité : seul l'utilisateur qui a
 * déclenché la génération peut télécharger.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await params;
  const entry = getExport(id);

  if (!entry) {
    return new Response("Export expiré ou introuvable", { status: 404 });
  }

  if (entry.userId !== session.user.id) {
    return new Response("Forbidden", { status: 403 });
  }

  // Encode-RFC5987 du filename pour les caractères non-ASCII (accents).
  const encoded = encodeURIComponent(entry.filename);

  // Convert Buffer to Uint8Array for Web Response API
  return new Response(new Uint8Array(entry.buffer), {
    headers: {
      "Content-Type": entry.contentType,
      "Content-Disposition": `attachment; filename*=UTF-8''${encoded}`,
      "Content-Length": String(entry.buffer.length),
      "Cache-Control": "private, no-store",
    },
  });
}
