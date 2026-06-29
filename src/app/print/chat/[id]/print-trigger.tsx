"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { IconPrinter } from "@tabler/icons-react";

export function PrintTrigger({ title }: { title: string }) {
  const t = useTranslations("print");

  useEffect(() => {
    const previousTitle = document.title;
    document.title = t("documentTitle", { title });
    const timer = setTimeout(() => window.print(), 250);
    return () => {
      clearTimeout(timer);
      document.title = previousTitle;
    };
  }, [title, t]);

  return (
    <div className="fixed top-4 right-4 print:hidden flex gap-2 z-50">
      <Button size="sm" variant="outline" onClick={() => window.print()}>
        <IconPrinter className="size-4" />
        {t("trigger.print")}
      </Button>
    </div>
  );
}
