import { and, eq, isNull, lt } from "drizzle-orm";
import { db } from "@/db";
import { cabinetSettings, conversations } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { getRedis } from "@/lib/redis";

/**
 * Purge de rétention RGPD — déclenchée par un planificateur EXTERNE (conteneur
 * cron, k8s CronJob, tâche planifiée Scaleway…), JAMAIS par une boucle in-process
 * (qui tournerait par réplica sur un déploiement horizontalement scalé).
 *
 * Politique conservatrice pour un produit juridique :
 * - on purge les CONVERSATIONS inactives (updatedAt) au-delà de retentionDays,
 *   en épargnant les conversations ÉPINGLÉES ;
 * - la cascade FK supprime messages + message_chunks ;
 * - les DOCUMENTS (pièces/preuves) et le JOURNAL D'AUDIT ne sont PAS purgés
 *   (préservation des preuves + trace de conformité) ;
 * - chaque purge est tracée dans l'audit (suppression prouvable).
 *
 * Sécurité : header partagé `x-cron-secret` == CRON_SECRET. Sans CRON_SECRET
 * configuré, la route est inerte (503) pour éviter une purge non protégée.
 * Single-flight via verrou Redis (deux crons concurrents ne purgent pas en double).
 */
export async function POST(req: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json(
      { error: "CRON_SECRET non configuré — purge désactivée." },
      { status: 503 }
    );
  }
  if (req.headers.get("x-cron-secret") !== secret) {
    return new Response("Unauthorized", { status: 401 });
  }

  const redis = getRedis();
  const lockKey = "cron:retention:lock";
  let acquired = true;
  try {
    acquired = (await redis.set(lockKey, "1", "EX", 300, "NX")) === "OK";
  } catch {
    // Redis indisponible : on continue (un seul planificateur appelle cette
    // route ; le verrou n'est qu'une protection anti-chevauchement).
    acquired = true;
  }
  if (!acquired) {
    return Response.json({ skipped: "déjà en cours" }, { status: 200 });
  }

  try {
    const [settings] = await db
      .select({ retentionDays: cabinetSettings.retentionDays })
      .from(cabinetSettings)
      .where(eq(cabinetSettings.id, 1))
      .limit(1);

    const days = settings?.retentionDays ?? null;
    if (!days || days <= 0) {
      return Response.json({ purged: 0, reason: "rétention désactivée" });
    }

    const threshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const deleted = await db
      .delete(conversations)
      .where(
        and(
          lt(conversations.updatedAt, threshold),
          isNull(conversations.pinnedAt)
        )
      )
      .returning({ id: conversations.id });

    await recordAudit({
      userId: null,
      action: "retention.purge",
      target: "conversations",
      meta: {
        count: deleted.length,
        retentionDays: days,
        threshold: threshold.toISOString(),
      },
    });

    return Response.json({
      purged: deleted.length,
      retentionDays: days,
      threshold: threshold.toISOString(),
    });
  } finally {
    try {
      await redis.del(lockKey);
    } catch {
      // verrou expirera de toute façon (EX 300)
    }
  }
}
