"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/db";
import { mcpServers, type CachedMcpTool } from "@/db/schema";
import { encrypt } from "@/lib/crypto";
import { mcpListTools } from "@/lib/mcp/client";

const TRANSPORTS = ["sse", "http"] as const;

const createSchema = z.object({
  label: z.string().trim().min(1).max(80),
  transport: z.enum(TRANSPORTS),
  url: z.url(),
  headers: z.string().optional().or(z.literal("")),
});

export type ActionResult = { ok: true } | { ok: false; error: string };

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

function parseHeaders(raw: string | undefined | null): Record<string, string> | null {
  if (!raw || !raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed)
    ) {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === "string") out[k] = v;
      }
      return out;
    }
    return null;
  } catch {
    return null;
  }
}

export async function createMcpServer(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const userId = await requireUserId();

  const parsed = createSchema.safeParse({
    label: formData.get("label"),
    transport: formData.get("transport"),
    url: formData.get("url"),
    headers: formData.get("headers") ?? "",
  });

  if (!parsed.success) {
    return { ok: false, error: "Champs invalides." };
  }

  let headersCiphertext: string | null = null;
  let headersIv: string | null = null;
  let headersTag: string | null = null;
  const headers = parseHeaders(parsed.data.headers);
  if (parsed.data.headers && headers === null) {
    return { ok: false, error: "Les headers doivent être un JSON {clé: valeur}." };
  }
  if (headers) {
    const blob = encrypt(JSON.stringify(headers));
    headersCiphertext = blob.ciphertext;
    headersIv = blob.iv;
    headersTag = blob.tag;
  }

  let inserted: typeof mcpServers.$inferSelect;
  try {
    [inserted] = await db
      .insert(mcpServers)
      .values({
        userId,
        label: parsed.data.label,
        transport: parsed.data.transport,
        url: parsed.data.url,
        headersCiphertext,
        headersIv,
        headersTag,
      })
      .returning();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur";
    if (msg.includes("mcp_servers_user_label_idx")) {
      return { ok: false, error: "Ce libellé est déjà utilisé." };
    }
    return { ok: false, error: "Impossible de créer le serveur MCP." };
  }

  // H24 : sync best-effort à la création — l'utilisateur voit immédiatement les
  // outils découverts (ou l'erreur), sans devoir cliquer « Synchroniser ». Un
  // échec de sync ne fait PAS échouer la création (il est persisté).
  try {
    const tools: CachedMcpTool[] = await mcpListTools(inserted);
    await db
      .update(mcpServers)
      .set({ toolsJson: tools, lastSyncedAt: new Date(), lastSyncError: null })
      .where(eq(mcpServers.id, inserted.id));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur inconnue";
    await db
      .update(mcpServers)
      .set({ lastSyncedAt: new Date(), lastSyncError: msg.slice(0, 500) })
      .where(eq(mcpServers.id, inserted.id));
  }

  revalidatePath("/settings/mcp");
  revalidatePath("/chat");
  return { ok: true };
}

export async function deleteMcpServer(id: string): Promise<void> {
  const userId = await requireUserId();
  await db
    .delete(mcpServers)
    .where(and(eq(mcpServers.id, id), eq(mcpServers.userId, userId)));
  revalidatePath("/settings/mcp");
}

export async function toggleMcpServerActive(id: string): Promise<void> {
  const userId = await requireUserId();
  const [current] = await db
    .select({ isActive: mcpServers.isActive })
    .from(mcpServers)
    .where(and(eq(mcpServers.id, id), eq(mcpServers.userId, userId)))
    .limit(1);
  if (!current) return;
  await db
    .update(mcpServers)
    .set({ isActive: !current.isActive })
    .where(and(eq(mcpServers.id, id), eq(mcpServers.userId, userId)));
  revalidatePath("/settings/mcp");
}

export async function syncMcpServer(id: string): Promise<void> {
  const userId = await requireUserId();
  const [server] = await db
    .select()
    .from(mcpServers)
    .where(and(eq(mcpServers.id, id), eq(mcpServers.userId, userId)))
    .limit(1);
  if (!server) return;

  try {
    const tools: CachedMcpTool[] = await mcpListTools(server);
    await db
      .update(mcpServers)
      .set({
        toolsJson: tools,
        lastSyncedAt: new Date(),
        lastSyncError: null,
      })
      .where(eq(mcpServers.id, id));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur inconnue";
    await db
      .update(mcpServers)
      .set({
        lastSyncedAt: new Date(),
        lastSyncError: msg.slice(0, 500),
      })
      .where(eq(mcpServers.id, id));
  }

  revalidatePath("/settings/mcp");
  revalidatePath("/chat");
}
