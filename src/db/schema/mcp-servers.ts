import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  pgEnum,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const mcpTransportEnum = pgEnum("mcp_transport", ["sse", "http"]);

/**
 * Definition cached from the MCP server at sync time.
 * Mirrors the relevant subset of MCP's listTools() response.
 */
export type CachedMcpTool = {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
};

export const mcpServers = pgTable(
  "mcp_servers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    transport: mcpTransportEnum("transport").notNull().default("sse"),
    url: text("url").notNull(),
    // Optional encrypted headers (Bearer tokens, custom auth headers).
    // Stored as JSON.stringify({ "Authorization": "Bearer …", … }).
    headersCiphertext: text("headers_ciphertext"),
    headersIv: text("headers_iv"),
    headersTag: text("headers_tag"),
    isActive: boolean("is_active").default(true).notNull(),
    // Cached list of tool definitions from the most recent successful sync.
    toolsJson: jsonb("tools_json").$type<CachedMcpTool[]>(),
    lastSyncedAt: timestamp("last_synced_at"),
    lastSyncError: text("last_sync_error"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("mcp_servers_user_label_idx").on(t.userId, t.label)]
);

export type McpServer = typeof mcpServers.$inferSelect;
export type NewMcpServer = typeof mcpServers.$inferInsert;
