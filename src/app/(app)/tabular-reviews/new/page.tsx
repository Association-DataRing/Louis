import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq, isNotNull, or } from "drizzle-orm";
import { IconArrowLeft } from "@tabler/icons-react";
import { auth } from "@/auth";
import { db } from "@/db";
import { documents, providerKeys } from "@/db/schema";
import { NewReviewForm } from "./new-review-form";

export default async function NewReviewPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = session.user.id;

  const [activeKeys, docList] = await Promise.all([
    db
      .select({
        id: providerKeys.id,
        label: providerKeys.label,
        type: providerKeys.type,
      })
      .from(providerKeys)
      .where(
        and(
          eq(providerKeys.userId, userId),
          eq(providerKeys.isActive, true)
        )
      )
      .orderBy(desc(providerKeys.isDefault), desc(providerKeys.createdAt)),
    db
      .select({
        id: documents.id,
        filename: documents.filename,
      })
      .from(documents)
      .where(
        and(
          eq(documents.userId, userId),
          or(
            isNotNull(documents.extractedText),
            isNotNull(documents.encExtractedText)
          )
        )
      )
      .orderBy(desc(documents.createdAt)),
  ]);

  if (activeKeys.length === 0) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-8 md:px-8 md:py-10">
        <Link
          href="/tabular-reviews"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
        >
          <IconArrowLeft className="size-3.5" />
          Retour
        </Link>
        <h1 className="font-heading text-3xl tracking-tight">
          Nouvelle analyse
        </h1>
        <div className="mt-6 border border-dashed border-border rounded-lg p-10 text-center">
          <p className="text-sm text-muted-foreground">
            Vous devez configurer et activer au moins un provider IA pour
            créer une analyse.
          </p>
          <Link
            href="/providers"
            className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Configurer un provider
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-8 md:px-8 md:py-10">
      <Link
        href="/tabular-reviews"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
      >
        <IconArrowLeft className="size-3.5" />
        Retour
      </Link>
      <header className="mb-8">
        <h1 className="font-heading text-3xl tracking-tight">
          Nouvelle analyse tabulaire
        </h1>
        <p className="mt-2 text-muted-foreground">
          Définissez les colonnes à extraire de vos documents, choisissez le
          modèle IA, et sélectionnez les fichiers à analyser.
        </p>
      </header>

      <NewReviewForm providerKeys={activeKeys} documents={docList} />
    </main>
  );
}
