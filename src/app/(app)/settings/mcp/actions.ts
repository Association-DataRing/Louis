"use server";

import type { ActionResult as BaseActionResult } from "@/lib/actions/result";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/permissions";
import { db } from "@/db";
import { mcpServers, type CachedMcpTool } from "@/db/schema";
import { encrypt } from "@/lib/crypto";
import { recordAudit } from "@/lib/audit";
import { mcpListTools } from "@/lib/mcp/client";

const TRANSPORTS = ["sse", "http"] as const;

const createSchema = z.object({
  label: z.string().trim().min(1).max(80),
  transport: z.enum(TRANSPORTS),
  url: z.url(),
  headers: z.string().optional().or(z.literal("")),
});

export type ActionResult = BaseActionResult;

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

  // Audit : un serveur MCP est un sink de credentials sortant — tracé comme
  // les providers/connecteurs.
  await recordAudit({
    userId,
    action: "mcp.add",
    target: parsed.data.label,
  });

  revalidatePath("/settings/mcp");
  revalidatePath("/chat");
  return { ok: true };
}

export async function deleteMcpServer(id: string): Promise<void> {
  const userId = await requireUserId();
  const [server] = await db
    .select({ label: mcpServers.label })
    .from(mcpServers)
    .where(and(eq(mcpServers.id, id), eq(mcpServers.userId, userId)))
    .limit(1);
  await db
    .delete(mcpServers)
    .where(and(eq(mcpServers.id, id), eq(mcpServers.userId, userId)));
  if (server) {
    await recordAudit({ userId, action: "mcp.delete", target: server.label });
  }
  revalidatePath("/settings/mcp");
}

export async function toggleMcpServerActive(
  id: string
): Promise<ActionResult> {
  const userId = await requireUserId();
  const [current] = await db
    .select({ isActive: mcpServers.isActive, label: mcpServers.label })
    .from(mcpServers)
    .where(and(eq(mcpServers.id, id), eq(mcpServers.userId, userId)))
    .limit(1);
  if (!current) return { ok: false, error: "Serveur MCP introuvable." };
  try {
    await db
      .update(mcpServers)
      .set({ isActive: !current.isActive })
      .where(and(eq(mcpServers.id, id), eq(mcpServers.userId, userId)));
  } catch {
    return { ok: false, error: "Impossible de modifier l'état du serveur." };
  }
  await recordAudit({
    userId,
    action: "mcp.toggle",
    target: current.label,
    meta: { active: !current.isActive },
  });
  revalidatePath("/settings/mcp");
  return { ok: true };
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
