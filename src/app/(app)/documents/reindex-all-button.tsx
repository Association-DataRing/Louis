"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { IconRefresh } from "@tabler/icons-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { reindexAllDocumentsAction } from "./actions";

export function ReindexAllButton() {
  const router = useRouter();
  const t = useTranslations("documents.reindexAll");
  const [pending, startTransition] = useTransition();

  function run(onlyUnindexed: boolean) {
    startTransition(async () => {
      const r = await reindexAllDocumentsAction({ onlyUnindexed });
      if (r.noKey && r.indexed === 0 && r.skipped === 0) {
        toast.error(t("noKey"));
      } else if (r.indexed === 0 && r.skipped > 0) {
        toast.success(t("allIndexed"));
      } else if (r.failed > 0) {
        toast.warning(t("partial", { indexed: r.indexed, failed: r.failed }));
      } else {
        toast.success(t("success", { count: r.indexed }));
      }
      router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 h-9 text-sm hover:bg-accent transition-colors disabled:opacity-50"
          title={t("title")}
        >
          <IconRefresh className={`size-4 ${pending ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline">{t("button")}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => run(true)}>
          {t("indexNew")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => run(false)}>
          {t("reindexAll")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
