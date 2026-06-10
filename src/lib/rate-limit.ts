import { getRedisReady } from "./redis";
import { log } from "./log";

/**
 * Rate-limit fenêtre fixe basé sur INCR + EXPIRE Redis.
 *
 * Mécanisme simple, suffisant pour la surface d'attaque actuelle :
 *  - INCR sur une clé `rl:<bucket>:<id>:<windowEpoch>`
 *  - Première incrémentation : pose EXPIRE = windowSeconds
 *  - allowed = count <= max
 *
 * Fenêtre fixe (vs sliding window) a un effet de bord : un attaquant peut
 * doubler la limite en tapant juste avant et juste après une frontière de
 * fenêtre. Acceptable pour le contexte multi-user d'un cabinet — les
 * limites annoncées sont des ordres de grandeur, pas des seuils chirurgicaux.
 *
 * Fail-open si Redis indisponible : on log une warning et on autorise. Une
 * panne Redis ne doit pas bloquer un cabinet en pleine consultation client.
 * Pour les usages où le fail-open est dangereux (paiements, etc.), il
 * faudrait fail-close — pas applicable ici.
 */
export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number; // epoch ms
  limit: number;
};

export type RateLimitBucket = "chat" | "upload" | "login" | "totp";

const BUCKET_CONFIG: Record<
  RateLimitBucket,
  { envVar: string; defaultMax: number; windowSeconds: number; label: string }
> = {
  chat: {
    envVar: "RATE_LIMIT_CHAT_PER_MINUTE",
    defaultMax: 30,
    windowSeconds: 60,
    label: "chat/min",
  },
  upload: {
    envVar: "RATE_LIMIT_UPLOAD_PER_HOUR",
    defaultMax: 60,
    windowSeconds: 3600,
    label: "upload/h",
  },
  login: {
    envVar: "RATE_LIMIT_LOGIN_PER_15MIN",
    defaultMax: 10,
    windowSeconds: 900,
    label: "login/15min",
  },
  // Plafond PAR COMPTE sur la vérification d'un second facteur (TOTP ou code
  // de secours), en complément du plafond login par IP. Bloque le brute-force
  // distribué d'un code à 6 chiffres quand l'attaquant a déjà le mot de passe.
  totp: {
    envVar: "RATE_LIMIT_TOTP_PER_15MIN",
    defaultMax: 10,
    windowSeconds: 900,
    label: "totp/15min",
  },
};

function readLimit(bucket: RateLimitBucket): number {
  const cfg = BUCKET_CONFIG[bucket];
  const raw = process.env[cfg.envVar];
  if (!raw) return cfg.defaultMax;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n) || n < 0) return cfg.defaultMax;
  return n;
}

/**
 * Applique le rate-limit pour (bucket, identifier).
 *
 * `identifier` est typiquement un userId pour les buckets authentifiés (chat,
 * upload) ou une IP pour les buckets pré-auth (login).
 *
 * Si le bucket est désactivé (max = 0), retourne immédiatement { allowed:
 * true } sans toucher Redis.
 */
export async function rateLimit(
  bucket: RateLimitBucket,
  identifier: string
): Promise<RateLimitResult> {
  const cfg = BUCKET_CONFIG[bucket];
  const limit = readLimit(bucket);
  const now = Date.now();
  const windowMs = cfg.windowSeconds * 1000;
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const resetAt = windowStart + windowMs;

  if (limit === 0) {
    return { allowed: true, remaining: Number.POSITIVE_INFINITY, resetAt, limit };
  }

  const key = `rl:${bucket}:${identifier}:${windowStart}`;

  try {
    // Attend (brièvement) la connexion initiale — sinon le premier appel
    // après le boot échouait en fail-open alors que Redis est up.
    const redis = await getRedisReady();
    if (!redis) throw new Error("Redis non prêt (connexion initiale)");
    const count = await redis.incr(key);
    if (count === 1) {
      // Premier hit dans cette fenêtre : pose l'expiration. Ajoute 5s de
      // marge pour ne pas perdre la clé à cause d'une horloge légèrement
      // décalée.
      await redis.expire(key, cfg.windowSeconds + 5);
    }
    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      resetAt,
      limit,
    };
  } catch (err) {
    // Redis indisponible — on autorise pour ne pas casser l'app, mais on
    // log pour que l'admin voie le problème dans son monitoring.
    log.warn("rate-limit", `Redis indisponible, fail-open sur ${cfg.label}`, {
      error: err instanceof Error ? err.message : err,
    });
    return { allowed: true, remaining: limit, resetAt, limit };
  }
}

/**
 * Helpers pour construire des Response 429 cohérentes avec les headers
 * `RateLimit-*` standardisés (draft IETF).
 */
export function rateLimitHeaders(res: RateLimitResult): Record<string, string> {
  return {
    "RateLimit-Limit": String(res.limit),
    "RateLimit-Remaining": String(
      Number.isFinite(res.remaining) ? res.remaining : res.limit
    ),
    "RateLimit-Reset": String(Math.ceil((res.resetAt - Date.now()) / 1000)),
  };
}

export function tooManyRequests(res: RateLimitResult): Response {
  return new Response("Too Many Requests", {
    status: 429,
    headers: {
      ...rateLimitHeaders(res),
      "Retry-After": String(Math.ceil((res.resetAt - Date.now()) / 1000)),
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
