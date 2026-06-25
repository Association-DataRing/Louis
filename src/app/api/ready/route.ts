import { sql } from "drizzle-orm";
import { db } from "@/db";
import { getRedisReady } from "@/lib/redis";

/**
 * Readiness probe — `/api/ready` retourne 200 SEULEMENT si les dépendances
 * externes (Postgres + Redis) répondent. Pour les load balancers qui
 * veulent suspendre le trafic pendant qu'une instance redémarre / migre.
 *
 * Détails :
 *  - Postgres : `SELECT 1` simple, timeout implicite via la pool.
 *  - Redis : `PING`. Si Redis est down, le rate-limit fail-open, donc on
 *    pourrait considérer ready=true même Redis down. Choix : on échoue
 *    quand même pour alerter l'opérateur — fail-open du rate-limit est
 *    un safety net, pas un état nominal acceptable.
 *
 * Pas de check S3 ici : un upload ratera de toute façon avec un 500 lisible
 * côté client. Le S3 healthcheck créerait du trafic permanent inutile.
 */
export const dynamic = "force-dynamic";

type CheckResult = { ok: true } | { ok: false; error: string };

async function checkDb(): Promise<CheckResult> {
  try {
    await db.execute(sql`SELECT 1`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "db error" };
  }
}

async function checkRedis(): Promise<CheckResult> {
  try {
    const r = await getRedisReady();
    if (!r) return { ok: false, error: "connexion initiale non établie" };
    const pong = await r.ping();
    if (pong !== "PONG") {
      return { ok: false, error: `unexpected response: ${pong}` };
    }
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "redis error",
    };
  }
}

export async function GET() {
  const [db, redis] = await Promise.all([checkDb(), checkRedis()]);
  const allOk = db.ok && redis.ok;

  return Response.json(
    {
      status: allOk ? "ready" : "not_ready",
      checks: { db, redis },
      timestamp: new Date().toISOString(),
    },
    { status: allOk ? 200 : 503 }
  );
}
