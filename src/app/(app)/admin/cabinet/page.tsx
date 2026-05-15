import { eq } from "drizzle-orm";
import { db } from "@/db";
import { cabinetSettings } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/permissions";
import { CabinetForm } from "./cabinet-form";

export default async function AdminCabinetPage() {
  await requireAdmin();
  const [settings] = await db
    .select()
    .from(cabinetSettings)
    .where(eq(cabinetSettings.id, 1))
    .limit(1);

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10 md:px-8 md:py-12">
      <header className="mb-10">
        <h1 className="font-heading text-3xl tracking-tight">
          Configuration du cabinet
        </h1>
        <p className="mt-2 text-muted-foreground max-w-2xl">
          Personnalise l&apos;identité du cabinet utilisée dans les documents
          générés (footer, mention légale) et certains défauts d&apos;UI.
        </p>
      </header>

      <CabinetForm initial={settings ?? null} />
    </main>
  );
}
