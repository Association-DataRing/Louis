/**
 * Détecte si une erreur provider est candidate au retry automatique.
 *
 * Retryable (transitoires) :
 * - HTTP 408 (request timeout), 425 (too early), 429 (rate limit),
 *   500 (server error), 502 (bad gateway), 503 (unavailable),
 *   504 (gateway timeout), 529 (Anthropic overload)
 * - Codes provider : 3505 (Mistral service_tier_capacity)
 * - Patterns textuels : "rate_limit", "overload", "capacity",
 *   "timeout", "ECONNRESET", "ETIMEDOUT", "fetch failed"
 *
 * Non-retryable (permanents) :
 * - HTTP 400 (bad request), 401 (unauthorized), 403 (forbidden),
 *   404 (model not found), 422 (validation)
 * - Patterns : "invalid_api_key", "model_not_found"
 */
export function isRetryableError(err: unknown): boolean {
  if (!err) return false;
  const e = err as { statusCode?: number; data?: { code?: string }; message?: string };

  // 1. HTTP status code (présent sur les AI_APICallError)
  const status = e.statusCode;
  if (typeof status === "number") {
    if ([408, 425, 429, 500, 502, 503, 504, 529].includes(status)) return true;
    if (status >= 400 && status < 500) return false; // autres 4xx = permanent
  }

  // 2. Code provider explicite (Mistral)
  const providerCode = e.data?.code;
  if (providerCode === "3505") return true;

  // 3. Patterns textuels dans le message
  const msg = e.message ?? "";
  const retryablePatterns = [
    /rate.?limit/i,
    /capacity.?exceeded/i,
    /service.?tier/i,
    /overload/i,
    /too.?many.?requests/i,
    /timeout/i,
    /ECONNRESET/,
    /ETIMEDOUT/,
    /fetch.?failed/i,
    /network/i,
    /\b(503|504|529)\b/,
  ];
  if (retryablePatterns.some((re) => re.test(msg))) return true;

  // 4. AI SDK enveloppe (AI_RetryError → cause)
  const wrapped = (err as { cause?: unknown; errors?: unknown[]; lastError?: unknown });
  if (wrapped.lastError) return isRetryableError(wrapped.lastError);
  if (wrapped.errors && Array.isArray(wrapped.errors) && wrapped.errors.length > 0) {
    return isRetryableError(wrapped.errors[wrapped.errors.length - 1]);
  }
  if (wrapped.cause) return isRetryableError(wrapped.cause);

  return false;
}

export interface RetryOptions {
  /** Nombre total de tentatives (1 + retries). Défaut 4. */
  maxAttempts?: number;
  /**
   * Délais entre tentatives en millisecondes. Par défaut, exponentiel
   * doux : 2s, 6s, 18s. Honnête sur les 429 Mistral qui ont besoin de
   * temps de respiration sans saturer l'utilisateur d'attente.
   */
  backoffMs?: number[];
  /** Callback appelé avant chaque retry (utile pour émettre des events UI). */
  onRetry?: (attempt: number, delayMs: number, err: unknown) => void | Promise<void>;
}

const DEFAULT_BACKOFF = [2000, 6000, 18000];

/**
 * Exécute `fn` avec retry exponentiel sur erreur transitoire. Les
 * erreurs permanentes (401, 400, modèle introuvable…) sont propagées
 * immédiatement sans retry. Utilisé par l'orchestrateur pour rendre
 * chaque agent résilient aux capacity drops Mistral/OpenAI.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {}
): Promise<T> {
  const backoff = opts.backoffMs ?? DEFAULT_BACKOFF;
  const maxAttempts = opts.maxAttempts ?? backoff.length + 1;

  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === maxAttempts) break;
      if (!isRetryableError(err)) break;

      const delay = backoff[Math.min(attempt - 1, backoff.length - 1)];
      if (opts.onRetry) {
        await opts.onRetry(attempt, delay, err);
      }
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastErr;
}
