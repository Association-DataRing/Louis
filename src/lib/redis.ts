import Redis from "ioredis";

/**
 * Client Redis partagé pour le rate-limit et les caches futurs.
 *
 * Lazy-init : la connexion s'établit au premier appel pour ne pas faire
 * exploser le démarrage si Redis n'est pas joignable. `lazyConnect: true`
 * évite les warnings au build (le module est chargé pendant `next build`).
 *
 * En cas d'indisponibilité Redis, les opérations rate-limit retombent en
 * mode "fail-open" (allow) — voir `src/lib/rate-limit.ts`. Les opérations
 * critiques (login lockout) restent fail-open également : un déni causé
 * par une panne d'infra serait plus dommageable que le risque résiduel
 * pendant une fenêtre courte.
 */

declare global {
  var __louisRedis: Redis | undefined;
  var __louisRedisConnect: Promise<unknown> | undefined;
}

function buildClient(): Redis {
  const url = process.env.REDIS_URL ?? "redis://localhost:6379";
  return new Redis(url, {
    lazyConnect: true,
    maxRetriesPerRequest: 2,
    enableOfflineQueue: false,
  });
}

export function getRedis(): Redis {
  if (!globalThis.__louisRedis) {
    globalThis.__louisRedis = buildClient();
    // Démarre la connexion dès la création : avec enableOfflineQueue=false,
    // une commande émise avant l'état `ready` échoue au lieu d'attendre la
    // connexion. La promesse est conservée pour que getRedisReady() puisse
    // attendre l'établissement au lieu d'échouer sur le premier appel.
    // L'erreur est avalée : la reconnexion automatique d'ioredis prend le
    // relais et le fail-open du rate-limit couvre l'intervalle.
    globalThis.__louisRedisConnect = globalThis.__louisRedis
      .connect()
      .catch(() => {});
  }
  return globalThis.__louisRedis;
}

/**
 * Client prêt à recevoir des commandes, ou `null` si Redis n'est pas
 * joignable dans le délai imparti (l'appelant fail-open).
 *
 * Raison d'être : avec enableOfflineQueue=false, une commande émise pendant
 * l'établissement de la connexion échoue immédiatement (« Stream isn't
 * writeable ») au lieu d'attendre — le PREMIER rate-limit après chaque boot
 * partait donc systématiquement en fail-open alors que Redis était up. Ici
 * on attend (brièvement) la fin du connect initial avant d'émettre.
 */
export async function getRedisReady(timeoutMs = 1500): Promise<Redis | null> {
  const r = getRedis();
  if (r.status === "ready") return r;
  await Promise.race([
    globalThis.__louisRedisConnect,
    new Promise((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
  // Relecture via le singleton : TS avait réduit le type de `status` après
  // l'early-return, alors que la propriété a pu changer pendant l'await.
  return getRedis().status === "ready" ? r : null;
}
