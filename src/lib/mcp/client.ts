import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { McpServer, CachedMcpTool } from "@/db/schema/mcp-servers";
import { decrypt } from "@/lib/crypto";
import { assertSafeUrl } from "@/lib/net-guard";

const CLIENT_INFO = { name: "louis", version: "0.0.1" };
const CONNECT_TIMEOUT_MS = 15_000;

function decryptHeaders(server: McpServer): Record<string, string> {
  if (!server.headersCiphertext || !server.headersIv || !server.headersTag) {
    return {};
  }
  const json = decrypt({
    ciphertext: server.headersCiphertext,
    iv: server.headersIv,
    tag: server.headersTag,
  });
  return JSON.parse(json) as Record<string, string>;
}

async function buildTransport(server: McpServer) {
  // Garde SSRF : l'URL du serveur MCP est fournie par l'utilisateur et fetchée
  // depuis le réseau du cabinet. assertSafeUrl bloque les cibles link-local /
  // métadonnées cloud (et, en mode strict, le LAN/localhost).
  const url = assertSafeUrl(server.url);
  const headers = decryptHeaders(server);

  if (server.transport === "sse") {
    return new SSEClientTransport(url, {
      requestInit: { headers },
      // SSE only allows headers via eventSourceInit on the wire.
      eventSourceInit: {
        fetch: (input, init) =>
          fetch(input, { ...init, headers: { ...init?.headers, ...headers } }),
      },
    });
  }
  return new StreamableHTTPClientTransport(url, {
    requestInit: { headers },
  });
}

async function withClient<T>(
  server: McpServer,
  fn: (client: Client) => Promise<T>
): Promise<T> {
  const transport = await buildTransport(server);
  const client = new Client(CLIENT_INFO);

  // Race the connect against a timeout so a hanging server doesn't pin the
  // request indefinitely.
  await Promise.race([
    client.connect(transport),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("MCP connect timed out")),
        CONNECT_TIMEOUT_MS
      )
    ),
  ]);

  try {
    return await fn(client);
  } finally {
    await client.close().catch(() => {});
  }
}

export async function mcpListTools(server: McpServer): Promise<CachedMcpTool[]> {
  return withClient(server, async (client) => {
    const result = await client.listTools();
    return result.tools.map((t) => ({
      name: t.name,
      description: t.description ?? undefined,
      inputSchema: t.inputSchema as Record<string, unknown>,
    }));
  });
}

export async function mcpCallTool(
  server: McpServer,
  toolName: string,
  args: Record<string, unknown>
): Promise<unknown> {
  return withClient(server, async (client) => {
    const res = await client.callTool({ name: toolName, arguments: args });
    // Most MCP servers return content as a list of text/image parts. We collapse
    // text parts to a single string for the LLM and pass through structured
    // content as-is.
    if (Array.isArray(res.content)) {
      const text = res.content
        .filter((c): c is { type: "text"; text: string } => c.type === "text")
        .map((c) => c.text)
        .join("\n");
      return text || res.content;
    }
    return res;
  });
}
