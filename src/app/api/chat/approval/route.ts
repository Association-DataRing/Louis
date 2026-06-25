import { z } from "zod";
import { auth } from "@/auth";
import { resolveApproval } from "@/lib/ai/approval";
import { recordAudit } from "@/lib/audit";

/**
 * Réponse à une demande d'approbation d'outil émise en cours de run
 * (`data-approval-request` dans le stream du chat). Résout la promesse qui
 * suspend l'exécution de l'outil côté serveur. Cf. lib/ai/approval.ts.
 */

const bodySchema = z.object({
  approvalId: z.string().min(1).max(64),
  approved: z.boolean(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Non authentifié" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Corps invalide" }, { status: 400 });
  }

  const { approvalId, approved } = parsed.data;
  const resolved = resolveApproval(session.user.id, approvalId, approved);

  if (resolved) {
    await recordAudit({
      userId: session.user.id,
      action: approved ? "tool.approve" : "tool.deny",
      target: approvalId,
    });
  }

  // 200 même si la demande est inconnue (déjà résolue / expirée) : le client
  // rafraîchit son état sans erreur visible — le résultat de l'outil dans le
  // stream fait foi.
  return Response.json({ ok: true, resolved });
}
