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
  }
  return globalThis.__louisRedis;
}
