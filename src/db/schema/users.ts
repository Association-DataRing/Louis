import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  pgEnum,
  integer,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["admin", "member"]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  avatarUrl: text("avatar_url"),
  role: userRoleEnum("role").notNull().default("member"),
  isActive: boolean("is_active").default(true).notNull(),
  lastLogin: timestamp("last_login"),
  /**
   * Plafond de dépense mensuel en centimes d'euros pour les appels IA.
   * `null` = pas de limite (comportement par défaut). À 0 = bloqué de fait.
   * Géré côté admin uniquement, contrôlé dans /api/chat/route.ts.
   */
  monthlyQuotaCents: integer("monthly_quota_cents"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type UserRole = (typeof userRoleEnum.enumValues)[number];
