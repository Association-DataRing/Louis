import type { ToolSet } from "ai";
import { db } from "@/db";
import { toolInvocations } from "@/db/schema";
import { log } from "@/lib/log";
import type { ToolErrorReason } from "@/lib/tools/result";

export type ToolCategory = "connector" | "document" | "rag" | "mcp";

/** Famille d'un outil à partir de son nom, pour borner les agrégats. */
function categorize(toolName: string): ToolCategory {
  if (toolName.startsWith("mcp__")) return "mcp";
  if (toolName === "generate_document" || toolName === "edit_document") {
    return "document";
  }
  if (
    toolName === "search_documents" ||
    toolName === "search_conversation_history"
  ) {
    return "rag";
  }
  return "connector";
}

/**
 * Normalise le nom d'un outil MCP (`mcp__serveur__outil`) en `mcp__*` pour
 * éviter une explosion de cardinalité dans les agrégats (un cabinet peut
 * brancher des dizaines d'outils MCP). Les outils natifs gardent leur nom.
 */
function normalizeToolName(toolName: string): string {
  return toolName.startsWith("mcp__") ? "mcp__*" : toolName;
}

/**
 * Détecte le succès/échec d'un résultat d'outil Louis. Les outils ne lèvent
 * jamais : ils renvoient soit l'enveloppe `{ ok, reason, error }` (result.ts),
 * soit, pour les outils MCP, `{ error }` quand le serveur est indisponible.
 */
function classifyResult(result: unknown): {
  success: boolean;
  errorReason: ToolErrorReason | null;
} {
  if (result && typeof result === "object") {
    if ("ok" in result) {
      const r = result as { ok: boolean; reason?: ToolErrorReason };
      return {
        success: r.ok === true,
        errorReason: r.ok ? null : (r.reason ?? "unknown"),
      };
    }
    // Enveloppe d'erreur MCP : { error: "..." }
    if ("error" in result && (result as { error?: unknown }).error) {
      return { success: false, errorReason: "server" };
    }
  }
  // Pas d'enveloppe d'erreur reconnue → considéré comme succès (ex. un MCP
  // qui renvoie une string framée non-fiable).
  return { success: true, errorReason: null };
}

/**
 * Enregistre une invocation d'outil (best-effort). N'attend jamais et
 * n'échoue jamais l'appel : un défaut de télémétrie ne doit pas casser un
 * tour de chat.
 */
function record(row: {
  userId: string | null;
  toolName: string;
  category: ToolCategory;
  success: boolean;
  errorReason: ToolErrorReason | null;
  durationMs: number;
}): void {
  db.insert(toolInvocations)
    .values({
      userId: row.userId,
      toolName: row.toolName,
      category: row.category,
      success: row.success,
      errorReason: row.errorReason,
      durationMs: row.durationMs,
    })
    .catch((err) => {
      log.warn("observability", "Échec d'enregistrement d'invocation d'outil", {
        toolName: row.toolName,
        error: err instanceof Error ? err.message : String(err),
      });
    });
}

/**
 * Enveloppe un ToolSet AI SDK pour mesurer la latence et tracer le
 * succès/échec de CHAQUE outil dans `tool_invocations`, sans toucher aux
 * définitions d'outils elles-mêmes. À appeler une fois sur le ToolSet
 * fusionné (connecteurs + MCP) juste avant `streamText`.
 *
 * Reproduit le pattern record-and-rethrow de vLLM Studio : on enregistre
 * TOUJOURS (succès, échec d'enveloppe, exception), puis on relaie le
 * résultat/erreur inchangé. Best-effort, ne modifie jamais le comportement
 * de l'outil.
 */
export function instrumentTools(tools: ToolSet, userId: string | null): ToolSet {
  const out: ToolSet = {};
  for (const [name, def] of Object.entries(tools)) {
    const execute = (def as { execute?: unknown }).execute;
    if (typeof execute !== "function") {
      // Outil sans execute (ex. côté client / human-in-the-loop) — inchangé.
      out[name] = def;
      continue;
    }
    const category = categorize(name);
    const recordedName = normalizeToolName(name);
    const original = execute as (...args: unknown[]) => Promise<unknown>;
    out[name] = {
      ...def,
      execute: async (...args: unknown[]) => {
        const startedAt = Date.now();
        try {
          const result = await original(...args);
          const { success, errorReason } = classifyResult(result);
          record({
            userId,
            toolName: recordedName,
            category,
            success,
            errorReason,
            durationMs: Date.now() - startedAt,
          });
          return result;
        } catch (err) {
          // Un outil ne devrait pas lever (cf. runTool), mais on couvre le
          // cas : on trace l'échec puis on relaie l'erreur sans la masquer.
          record({
            userId,
            toolName: recordedName,
            category,
            success: false,
            errorReason: "unknown",
            durationMs: Date.now() - startedAt,
          });
          throw err;
        }
      },
    } as ToolSet[string];
  }
  return out;
}
