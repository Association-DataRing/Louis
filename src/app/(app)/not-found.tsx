import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function NotFound() {
  const t = await getTranslations("errors.notFound");
  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-lg flex-col items-center justify-center px-6 text-center">
      <p className="font-heading text-6xl tracking-tight text-muted-foreground tabular-nums">
        404
      </p>
      <h1 className="mt-4 font-heading text-2xl tracking-tight">
        {t("title")}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {t("body")}
      </p>
      <Link
        href="/dashboard"
        className="mt-6 inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm text-primary-foreground transition-opacity hover:opacity-90"
      >
        {t("backToDashboard")}
      </Link>
    </main>
  );
}
