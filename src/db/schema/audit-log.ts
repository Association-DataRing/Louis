import { pgTable, uuid, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { users } from "./users";

/**
 * Journal d'audit — événements admin / sécurité (login, MAJ provider key,
 * suppression doc, création user, etc.). Append-only, indexable par
 * (userId, createdAt) pour les recherches « qu'a fait X dernièrement ».
 *
 * `action` est un enum-like string ("user.create", "doc.delete", …).
 * `target` est libre (UUID doc, email, …). `meta` jsonb pour le contexte
 * (IP, user-agent, motif).
 */
export const auditLog = pgTable("audit_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  // L'utilisateur qui a déclenché l'action — null si action système.
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  target: text("target"),
  meta: jsonb("meta"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type AuditLog = typeof auditLog.$inferSelect;
export type NewAuditLog = typeof auditLog.$inferInsert;
