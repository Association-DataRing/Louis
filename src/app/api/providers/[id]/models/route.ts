import { auth } from "@/auth";
import { loadProviderKey } from "@/lib/providers/factory";
import { fetchLiveModels, LiveCatalogError } from "@/lib/providers/live-catalog";

/**
 * GET /api/providers/[id]/models — retourne la liste live des modèles
 * exposés par le provider associé à cette clé. Pas de cache pour
 * refléter immédiatement les nouveautés du provider.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }
  const userId = session.user.id;
  const { id } = await params;

  let key;
  try {
    key = await loadProviderKey(userId, id);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Provider error";
    return new Response(msg, { status: 400 });
  }

  try {
    const models = await fetchLiveModels(key);
    return Response.json({
      providerType: key.type,
      keyLabel: key.label,
      models,
    });
  } catch (err) {
    if (err instanceof LiveCatalogError) {
      return Response.json(
        { error: err.message, code: err.status ?? 500 },
        { status: err.status ?? 502 }
      );
    }
    const msg = err instanceof Error ? err.message : "Erreur inconnue";
    return Response.json({ error: msg }, { status: 502 });
  }
}
