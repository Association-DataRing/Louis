import { tool, jsonSchema, type ToolSet } from "ai";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { mcpServers } from "@/db/schema";
import { mcpCallTool } from "./client";

/**
 * Sanitize an MCP tool name into something AI SDK tool names accept (lowercase
 * letters / digits / underscores). MCP names allow dots etc., AI SDK does not.
 */
function safeToolName(prefix: string, raw: string): string {
  const slug = raw
    .replace(/[^a-zA-Z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
  return `${prefix}__${slug || "tool"}`;
}

/**
 * Build AI SDK tools for every active MCP server of `userId`, using the
 * cached tool definitions from each row's `tools_json`. Execution opens a
 * fresh MCP connection per call — adequate for v0.1 with a few tools per
 * server.
 */
export async function buildMcpToolsForUser(userId: string): Promise<ToolSet> {
  const servers = await db
    .select()
    .from(mcpServers)
    .where(
      and(eq(mcpServers.userId, userId), eq(mcpServers.isActive, true))
    );

  const out: ToolSet = {};

  for (const server of servers) {
    const cached = server.toolsJson ?? [];
    const prefix = safeToolName("mcp", server.label);
    for (const t of cached) {
      const name = safeToolName(prefix, t.name);
      out[name] = tool({
        description: t.description ?? `Outil MCP : ${t.name} (${server.label})`,
        inputSchema: jsonSchema(t.inputSchema),
        execute: async (input) =>
          mcpCallTool(server, t.name, input as Record<string, unknown>),
      });
    }
  }

  return out;
}
