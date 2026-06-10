import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./users";

/**
 * Télémétrie d'exécution des outils (tools connecteurs + MCP).
 *
 * Le journal d'audit (`audit_log`) trace QUI a fait QUOI pour la conformité ;
 * cette table répond à une autre question, opérationnelle : QUEL outil est
 * lent, échoue, et à quelle fréquence. Indispensable pour la fiabilité d'un
 * outil juridique (un `legifrance_search` qui timeout en silence dégrade les
 * réponses sans laisser de trace).
 *
 * Inspiré du store d'observabilité de vLLM Studio (record-and-rethrow par
 * appel), adapté au modèle multi-tenant de Louis (scopé par userId) et à sa
 * stack Postgres/Drizzle.
 *
 * Best-effort : l'enregistrement ne doit jamais faire échouer l'exécution de
 * l'outil lui-même.
 */
export const toolInvocations = pgTable(
  "tool_invocations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // Utilisateur qui a déclenché l'appel — null si contexte système.
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    // Nom de l'outil (ex. "legifrance_search", "generate_document",
    // "mcp__serveur__outil"). Les outils MCP sont normalisés au préfixe
    // "mcp__" pour borner la cardinalité des agrégats.
    toolName: text("tool_name").notNull(),
    // "connector" | "document" | "rag" | "mcp" — famille de l'outil.
    category: text("category").notNull(),
    success: boolean("success").notNull(),
    // Taxonomie d'erreur ToolErrorReason quand success=false
    // (config/auth/rate_limit/timeout/server/network/validation/unknown).
    errorReason: text("error_reason"),
    durationMs: integer("duration_ms").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    // Agrégats « par outil sur la période » (page usage admin).
    index("tool_invocations_name_created_idx").on(t.toolName, t.createdAt),
    // Filtre « mes appels récents » + nettoyage par rétention.
    index("tool_invocations_created_idx").on(t.createdAt),
  ]
);

export type ToolInvocation = typeof toolInvocations.$inferSelect;
export type NewToolInvocation = typeof toolInvocations.$inferInsert;
