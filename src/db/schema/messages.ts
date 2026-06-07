import {
  pgTable,
  uuid,
  text,
  timestamp,
  pgEnum,
  jsonb,
  integer,
  index,
} from "drizzle-orm/pg-core";
import type { DocumentArtifactMeta } from "@/lib/ai/tool-result";
import { conversations } from "./conversations";

/**
 * Forme (non contrainte par Postgres) de la colonne `metadata` jsonb :
 *  - message user : `documentIds` (pièces jointes).
 *  - message assistant : `documents` (artefacts générés/édités ce tour) —
 *    source de vérité pour rendre la carte d'artefact, indépendante des tool
 *    parts (qui ne se reconstruisent pas de façon fiable au reload).
 */
export type MessageMetadata = {
  documentIds?: string[];
  documents?: DocumentArtifactMeta[];
};

export const messageRoleEnum = pgEnum("message_role", [
  "user",
  "assistant",
  "system",
]);

/**
 * Format minimal stocké pour les tool calls — sera ré-hydraté en UIMessage
 * parts au load. Volontairement simple : on garde l'essentiel (input/output)
 * sans embarquer toute la structure interne d'AI SDK v6.
 */
export type SavedPart =
  | { type: "text"; text: string }
  | {
      type: "tool-call";
      toolCallId: string;
      toolName: string;
      input: unknown;
    }
  | {
      type: "tool-result";
      toolCallId: string;
      toolName: string;
      output: unknown;
    }
  // Trail d'audit multi-agents (events/outputs/retries) + skills détectées,
  // persistés pour survivre au reload (theatre, badges, pills skills). Le
  // `dataType` est le type du data part AI SDK (ex. "data-agent-event").
  | { type: "data"; dataType: string; data: unknown };

export const messages = pgTable("messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  conversationId: uuid("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  role: messageRoleEnum("role").notNull(),
  content: text("content").notNull(),
  metadata: jsonb("metadata").$type<MessageMetadata>(),
  // Tool calls + textes au format minimal — null sur les anciens messages
  // (on retombe alors sur le texte seul).
  parts: jsonb("parts").$type<SavedPart[]>(),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  modelId: text("model_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  // Requête la plus chaude de l'app : tous les messages d'une conversation,
  // ordonnés. Index composite (conversationId, createdAt) → plus de scan
  // séquentiel qui se dégrade avec le volume.
  index("messages_conversation_idx").on(t.conversationId, t.createdAt),
]);

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
