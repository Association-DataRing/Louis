import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  pgEnum,
  integer,
  jsonb,
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
  // 2FA TOTP. `totpSecretPending` détient le secret le temps de l'enrôlement ;
  // il est promu vers `totpSecret` + `totpEnabled=true` une fois un premier
  // code confirmé. `backupCodes` = codes de secours à usage unique, HACHÉS.
  totpSecret: text("totp_secret"),
  totpSecretPending: text("totp_secret_pending"),
  totpEnabled: boolean("totp_enabled").default(false).notNull(),
  backupCodes: jsonb("backup_codes").$type<string[]>(),
  // Version d'identifiants : stampée dans le JWT à la connexion, incrémentée au
  // changement de mot de passe et à la désactivation 2FA. Le callback jwt
  // rejette tout token dont la version a divergé → les sessions existantes sont
  // invalidées quand l'utilisateur change son mot de passe (remédiation réelle
  // après suspicion de compromission, malgré la stratégie JWT 30 jours).
  tokenVersion: integer("token_version").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type UserRole = (typeof userRoleEnum.enumValues)[number];
