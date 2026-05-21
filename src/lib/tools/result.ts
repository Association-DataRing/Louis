/**
 * Standard return shape for AI SDK tool executions. We never let tools throw —
 * raw errors bubble up as opaque "tool execution failed" strings to the model,
 * which then hallucinates an explanation. Returning a structured envelope lets
 * the model relay a precise, actionable message to the user.
 */
export type ToolResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: ToolErrorReason; error: string };

export type ToolErrorReason =
  | "config" // connector missing / inactive
  | "auth" // 401/403, OAuth expired
  | "rate_limit" // 429
  | "timeout" // request aborted
  | "server" // 5xx
  | "network" // fetch failed without response
  | "validation" // bad input
  | "unknown";

export function toolError(
  reason: ToolErrorReason,
  message: string
): ToolResult<never> {
  return { ok: false, reason, error: message };
}

export function toolOk<T>(data: T): ToolResult<T> {
  return { ok: true, data };
}

/**
 * Run an async tool body, mapping common failure modes (AbortError, fetch
 * network errors, thrown Errors) to a structured ToolResult.
 */
export async function runTool<T>(
  body: () => Promise<ToolResult<T>>
): Promise<ToolResult<T>> {
  try {
    return await body();
  } catch (err) {
    if (err instanceof Error) {
      if (err.name === "AbortError") {
        return toolError(
          "timeout",
          "Le service externe n'a pas répondu à temps. Réessayez dans un instant."
        );
      }
      // Undici / Node fetch surface raw TypeErrors for DNS, refused, reset…
      if (err.name === "TypeError" && /fetch/i.test(err.message)) {
        return toolError(
          "network",
          "Impossible de joindre le service externe (problème réseau)."
        );
      }
      return toolError("unknown", err.message);
    }
    return toolError("unknown", "Erreur inconnue lors de l'appel de l'outil.");
  }
}

/**
 * Map an HTTP response status to a ToolErrorReason + french message.
 */
export function httpReason(
  service: string,
  status: number
): { reason: ToolErrorReason; error: string } {
  if (status === 401 || status === 403) {
    return {
      reason: "auth",
      error: `${service} a refusé l'authentification (${status}). Vérifiez la clé ou les identifiants dans /connectors.`,
    };
  }
  if (status === 429) {
    return {
      reason: "rate_limit",
      error: `${service} a appliqué un rate limit (429). Patientez quelques secondes avant de réessayer.`,
    };
  }
  if (status >= 500) {
    return {
      reason: "server",
      error: `${service} est temporairement indisponible (${status}).`,
    };
  }
  return {
    reason: "unknown",
    error: `${service} a renvoyé une erreur ${status}.`,
  };
}
