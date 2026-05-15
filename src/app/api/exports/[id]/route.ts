import { auth } from "@/auth";
import { getExportForUser } from "@/lib/docgen";

/**
 * Sert un document généré (DOCX/PDF) à partir de son ID éphémère.
 *
 * Les exports vivent 10 min en DB — survit aux hot-reloads dev et aux
 * invocations multiples. Vérification d'identité : seul l'utilisateur qui
 * a déclenché la génération peut télécharger.
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
  const entry = await getExportForUser(id, session.user.id);

  if (!entry) {
    return new Response("Export expiré ou introuvable", { status: 404 });
  }

  // Encode RFC5987 pour les caractères non-ASCII (accents).
  const encoded = encodeURIComponent(entry.filename);

  // Buffer -> Uint8Array pour le Web Response API.
  return new Response(new Uint8Array(entry.buffer), {
    headers: {
      "Content-Type": entry.contentType,
      "Content-Disposition": `attachment; filename*=UTF-8''${encoded}`,
      "Content-Length": String(entry.buffer.length),
      "Cache-Control": "private, no-store",
    },
  });
}
