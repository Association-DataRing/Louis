import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  pgEnum,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const providerTypeEnum = pgEnum("provider_type", [
  "mistral",
  "scaleway",
  "ovh",
  "albert",
  "anthropic",
  "openai",
  "openai_compatible",
]);

export const providerKeys = pgTable(
  "provider_keys",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: providerTypeEnum("type").notNull(),
    label: text("label").notNull(),
    apiKeyCiphertext: text("api_key_ciphertext").notNull(),
    apiKeyIv: text("api_key_iv").notNull(),
    apiKeyTag: text("api_key_tag").notNull(),
    baseUrl: text("base_url"),
    isActive: boolean("is_active").default(true).notNull(),
    isDefault: boolean("is_default").default(false).notNull(),
    lastTestedAt: timestamp("last_tested_at"),
    lastTestStatus: text("last_test_status"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("provider_keys_user_label_idx").on(t.userId, t.label)]
);

export type ProviderKey = typeof providerKeys.$inferSelect;
export type NewProviderKey = typeof providerKeys.$inferInsert;
