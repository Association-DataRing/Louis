import {
  pgTable,
  uuid,
  text,
  timestamp,
  pgEnum,
  jsonb,
  integer,
} from "drizzle-orm/pg-core";
import { conversations } from "./conversations";

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
    };

export const messages = pgTable("messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  conversationId: uuid("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  role: messageRoleEnum("role").notNull(),
  content: text("content").notNull(),
  metadata: jsonb("metadata"),
  // Tool calls + textes au format minimal — null sur les anciens messages
  // (on retombe alors sur le texte seul).
  parts: jsonb("parts").$type<SavedPart[]>(),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  modelId: text("model_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
