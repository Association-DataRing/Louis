import { pgTable, integer, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Paramètres du cabinet — singleton (une seule row id=1), géré depuis
 * /admin/cabinet. Utilisé pour personnaliser les documents générés
 * (footer custom, nom du cabinet) et les défauts globaux.
 */
export const cabinetSettings = pgTable("cabinet_settings", {
  id: integer("id").primaryKey().default(1),
  name: text("name").notNull().default("Cabinet"),
  footerText: text("footer_text").notNull().default(""),
  legalDisclaimer: text("legal_disclaimer").notNull().default(""),
  /**
   * Rétention RGPD : purge auto des conversations INACTIVES (non épinglées)
   * au-delà de N jours, via /api/cron/retention. null = désactivé (défaut).
   * Documents (pièces/preuves) et journal d'audit ne sont PAS purgés.
   */
  retentionDays: integer("retention_days"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type CabinetSettings = typeof cabinetSettings.$inferSelect;
