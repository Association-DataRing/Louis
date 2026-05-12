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

export const connectorTypeEnum = pgEnum("connector_type", [
  "piste",
  "pappers",
]);

export const connectorKeys = pgTable(
  "connector_keys",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: connectorTypeEnum("type").notNull(),
    label: text("label").notNull(),
    // JSON.stringify(credentials) encrypted as a single blob (AES-256-GCM).
    credentialsCiphertext: text("credentials_ciphertext").notNull(),
    credentialsIv: text("credentials_iv").notNull(),
    credentialsTag: text("credentials_tag").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    lastTestedAt: timestamp("last_tested_at"),
    lastTestStatus: text("last_test_status"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("connector_keys_user_label_idx").on(t.userId, t.label),
  ]
);

export type ConnectorKey = typeof connectorKeys.$inferSelect;
export type NewConnectorKey = typeof connectorKeys.$inferInsert;
