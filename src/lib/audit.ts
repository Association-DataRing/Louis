import { db } from "@/db";
import { auditLog } from "@/db/schema";

/**
 * Helper d'append au journal d'audit. Best-effort : si l'INSERT échoue
 * pour une raison (DB momentanément down, schema obsolète), on log mais
 * on ne propage pas — un crash d'audit ne doit pas bloquer une action
 * fonctionnelle.
 *
 * Conventions sur `action` (kebab-case + namespace) :
 *   - "user.create" / "user.update" / "user.disable" / "user.delete"
 *   - "provider.add" / "provider.toggle" / "provider.delete"
 *   - "doc.delete"
 *   - "cabinet.update"
 *   - "auth.login" / "auth.login.failed"
 */
export async function recordAudit({
  userId,
  action,
  target,
  meta,
}: {
  userId: string | null;
  action: string;
  target?: string | null;
  meta?: Record<string, unknown>;
}): Promise<void> {
  try {
    await db.insert(auditLog).values({
      userId: userId ?? null,
      action,
      target: target ?? null,
      meta: meta ?? null,
    });
  } catch (err) {
    console.warn("[audit] insert failed", {
      action,
      target,
      error: err instanceof Error ? err.message : err,
    });
  }
}
