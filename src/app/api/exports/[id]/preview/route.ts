import mammoth from "mammoth";
import { auth } from "@/auth";
import { getExportForUser } from "@/lib/docgen";

/**
 * Prévisualisation HTML d'un export DOCX. Utilise mammoth pour convertir le
 * buffer DOCX en HTML lisible (préserve titres, listes, paragraphes, mise
 * en forme inline). Pour les PDF on n'a pas besoin de preview HTML — le
 * navigateur affiche le PDF nativement dans un iframe.
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
    return new Response("Export introuvable ou expiré", { status: 404 });
  }

  // Mammoth ne gère que les DOCX. Pour les PDF on renvoie 415 — l'iframe
  // navigateur sait afficher le PDF lui-même via la route /api/exports/[id].
  if (
    entry.contentType !==
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return new Response("Preview HTML disponible uniquement pour DOCX", {
      status: 415,
    });
  }

  try {
    const result = await mammoth.convertToHtml({ buffer: entry.buffer });
    return Response.json({
      html: result.value,
      warnings: result.messages
        .filter((m) => m.type === "warning")
        .map((m) => m.message),
    });
  } catch (err) {
    return new Response(
      `Erreur de conversion : ${err instanceof Error ? err.message : "inconnue"}`,
      { status: 500 }
    );
  }
}
