import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { IconArrowLeft } from "@tabler/icons-react";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { providerKeys } from "@/db/schema";
import { getEnabledModelKeys } from "../actions";
import { LibraryBrowser } from "./library-browser";

export default async function ModelLibraryPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = session.user.id;
  const t = await getTranslations("settings.models");

  const keys = await db
    .select({
      id: providerKeys.id,
      label: providerKeys.label,
      type: providerKeys.type,
      isActive: providerKeys.isActive,
    })
    .from(providerKeys)
    .where(eq(providerKeys.userId, userId))
    .orderBy(asc(providerKeys.label));

  const activeKeys = keys.filter((k) => k.isActive);

  const enabledSet = await getEnabledModelKeys(userId);
  const enabledKeys = [...enabledSet];

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-8 md:px-8 md:py-10">
      <header className="mb-6">
        <Link
          href="/settings/models"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <IconArrowLeft className="size-3.5" />
          {t("library.back")}
        </Link>
        <p className="text-xs text-foreground/70 uppercase tracking-wider">
          {t("library.eyebrow")}
        </p>
        <h1 className="mt-1 font-heading text-3xl tracking-tight">
          {t("library.title")}
        </h1>
        <p className="mt-2 text-muted-foreground text-sm max-w-2xl">
          {t("library.subtitle")}
        </p>
      </header>

      <LibraryBrowser
        providerKeys={activeKeys.map((k) => ({
          id: k.id,
          label: k.label,
          type: k.type,
        }))}
        enabledKeys={enabledKeys}
      />
    </main>
  );
}
