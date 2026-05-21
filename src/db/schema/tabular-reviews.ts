import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { projects } from "./projects";
import { documents } from "./documents";
import { providerKeys } from "./provider-keys";

export type ReviewColumnFormat =
  | "text"
  | "bulleted_list"
  | "date"
  | "money"
  | "boolean";

export type ReviewColumn = {
  /** Stable identifier used as JSON key in extracted values. */
  id: string;
  /** Displayed in the grid header. */
  label: string;
  /** Instruction donnée au LLM pour extraire la valeur de cette colonne. */
  prompt: string;
  /**
   * Format attendu pour la valeur extraite. Sert d'indice au prompt système
   * du run d'extraction (« réponds en liste à puces », « réponds au format
   * JJ/MM/AAAA »…). Optionnel — les colonnes pré-existantes n'ont pas ce
   * champ et sont traitées comme "text".
   */
  format?: ReviewColumnFormat;
};

export const tabularReviews = pgTable("tabular_reviews", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").references(() => projects.id, {
    onDelete: "set null",
  }),
  providerKeyId: uuid("provider_key_id").references(() => providerKeys.id, {
    onDelete: "set null",
  }),
  modelId: text("model_id"),
  name: text("name").notNull(),
  columns: jsonb("columns").$type<ReviewColumn[]>().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const reviewRowStatusValues = [
  "pending",
  "running",
  "ok",
  "error",
] as const;

export type ReviewRowStatus = (typeof reviewRowStatusValues)[number];

export const tabularReviewRows = pgTable(
  "tabular_review_rows",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reviewId: uuid("review_id")
      .notNull()
      .references(() => tabularReviews.id, { onDelete: "cascade" }),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    /** {columnId: value} — string values for v0.1 (LLM extraction). */
    values: jsonb("values").$type<Record<string, string>>().default({}),
    status: text("status").$type<ReviewRowStatus>().default("pending").notNull(),
    error: text("error"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("tabular_review_rows_review_doc_idx").on(
      t.reviewId,
      t.documentId
    ),
  ]
);

export type TabularReview = typeof tabularReviews.$inferSelect;
export type NewTabularReview = typeof tabularReviews.$inferInsert;
export type TabularReviewRow = typeof tabularReviewRows.$inferSelect;
export type NewTabularReviewRow = typeof tabularReviewRows.$inferInsert;
