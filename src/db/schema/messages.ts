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

export const messages = pgTable("messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  conversationId: uuid("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  role: messageRoleEnum("role").notNull(),
  content: text("content").notNull(),
  // Reserve for future structured data (citations, tool calls, attachments).
  metadata: jsonb("metadata"),
  // Token usage as reported by the provider (only on assistant messages).
  // Nullable so old rows stay valid after the migration.
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  modelId: text("model_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
