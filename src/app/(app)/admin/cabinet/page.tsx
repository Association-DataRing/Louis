import { eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { db } from "@/db";
import { cabinetSettings } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/permissions";
import { CabinetForm } from "./cabinet-form";

export default async function AdminCabinetPage() {
  await requireAdmin();
  const t = await getTranslations("admin.cabinet");
  const [settings] = await db
    .select()
    .from(cabinetSettings)
    .where(eq(cabinetSettings.id, 1))
    .limit(1);

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10 md:px-8 md:py-12">
      <header className="mb-10">
        <h1 className="font-heading text-3xl tracking-tight">
          {t("title")}
        </h1>
        <p className="mt-2 text-muted-foreground max-w-2xl">
          {t("subtitle")}
        </p>
      </header>

      <CabinetForm initial={settings ?? null} />
    </main>
  );
}
