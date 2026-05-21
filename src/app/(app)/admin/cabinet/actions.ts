"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { cabinetSettings } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/permissions";
import { recordAudit } from "@/lib/audit";

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  footerText: z.string().trim().max(200),
  legalDisclaimer: z.string().trim().max(1000),
});

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string };

export async function updateCabinetSettings(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const { userId } = await requireAdmin();
  const parsed = schema.safeParse({
    name: formData.get("name"),
    footerText: formData.get("footerText"),
    legalDisclaimer: formData.get("legalDisclaimer"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Champs invalides." };
  }
  await db
    .update(cabinetSettings)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(cabinetSettings.id, 1));
  await recordAudit({
    userId,
    action: "cabinet.update",
  });
  revalidatePath("/admin/cabinet");
  return { ok: true };
}
