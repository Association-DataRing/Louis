import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemePicker } from "./theme-picker";

export default async function GeneralSettingsPage() {
  const t = await getTranslations("settings.general");
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10 md:px-8 md:py-12">
      <header className="mb-10">
        <h1 className="font-heading text-3xl tracking-tight">{t("title")}</h1>
        <p className="mt-2 text-muted-foreground">{t("subtitle")}</p>
      </header>

      <section className="mb-12">
        <h2 className="font-heading text-lg tracking-tight mb-1">
          {t("appearanceHeading")}
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          {t("appearanceHelp")}
        </p>
        <ThemePicker />
      </section>

      <section className="mb-12">
        <h2 className="font-heading text-lg tracking-tight mb-1">
          {t("languageHeading")}
        </h2>
        <p className="text-sm text-muted-foreground mb-4">{t("languageHelp")}</p>
        <LanguageSwitcher />
      </section>

      <section className="mb-12">
        <h2 className="font-heading text-lg tracking-tight mb-1">
          {t("sovereigntyHeading")}
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
          {t("sovereigntyBody")}
        </p>
      </section>

      <section className="border-l-2 border-primary/40 pl-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground mb-1">{t("aboutHeading")}</p>
        <p>{t("aboutBody")}</p>
      </section>
    </main>
  );
}
