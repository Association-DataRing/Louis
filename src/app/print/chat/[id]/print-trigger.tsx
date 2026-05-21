"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { IconPrinter } from "@tabler/icons-react";

export function PrintTrigger({ title }: { title: string }) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = `Louis – ${title}`;
    const t = setTimeout(() => window.print(), 250);
    return () => {
      clearTimeout(t);
      document.title = previousTitle;
    };
  }, [title]);

  return (
    <div className="fixed top-4 right-4 print:hidden flex gap-2 z-50">
      <Button size="sm" variant="outline" onClick={() => window.print()}>
        <IconPrinter className="size-4" />
        Imprimer / PDF
      </Button>
    </div>
  );
}
