import { and, eq, lt } from "drizzle-orm";
import { db } from "@/db";
import { documentExports } from "@/db/schema";

/**
 * Store DB-backed des documents générés.
 *
 * Pourquoi DB et pas Map mémoire : en dev, chaque hot-reload Next renvoie
 * une instance Map vide → les URLs `/api/exports/<id>` retournées par le
 * tool ne survivent pas à un save. En prod / serverless, même problème
 * d'éphémeralité. Une table Postgres avec TTL via expires_at résout les
 * deux cas avec un seul code path.
 *
 * GC paresseux : à chaque insert on supprime les entrées expirées.
 */
const TTL_MS = 10 * 60 * 1000; // 10 minutes

export type Export = {
  id: string;
  buffer: Buffer;
  contentType: string;
  filename: string;
  userId: string;
};

async function gc(): Promise<void> {
  await db
    .delete(documentExports)
    .where(lt(documentExports.expiresAt, new Date()));
}

export async function putExport(
  buffer: Buffer,
  contentType: string,
  filename: string,
  userId: string
): Promise<string> {
  // Best-effort GC — ne bloque pas le put si ça échoue.
  gc().catch(() => {});
  const [row] = await db
    .insert(documentExports)
    .values({
      userId,
      filename,
      contentType,
      data: buffer,
      expiresAt: new Date(Date.now() + TTL_MS),
    })
    .returning({ id: documentExports.id });
  return row.id;
}

export async function getExport(id: string): Promise<Export | null> {
  const [row] = await db
    .select()
    .from(documentExports)
    .where(eq(documentExports.id, id))
    .limit(1);
  if (!row) return null;
  if (row.expiresAt < new Date()) {
    // Lazy cleanup of stale entry.
    await db.delete(documentExports).where(eq(documentExports.id, id));
    return null;
  }
  return {
    id: row.id,
    buffer: Buffer.from(row.data),
    contentType: row.contentType,
    filename: row.filename,
    userId: row.userId,
  };
}

export async function getExportForUser(
  id: string,
  userId: string
): Promise<Export | null> {
  const [row] = await db
    .select()
    .from(documentExports)
    .where(
      and(
        eq(documentExports.id, id),
        eq(documentExports.userId, userId)
      )
    )
    .limit(1);
  if (!row) return null;
  if (row.expiresAt < new Date()) {
    await db.delete(documentExports).where(eq(documentExports.id, id));
    return null;
  }
  return {
    id: row.id,
    buffer: Buffer.from(row.data),
    contentType: row.contentType,
    filename: row.filename,
    userId: row.userId,
  };
}
