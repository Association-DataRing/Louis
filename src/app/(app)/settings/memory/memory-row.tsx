"use client";

import { useTransition } from "react";
import {
  IconCheck,
  IconArrowBackUp,
  IconTrash,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { approveMemory, unapproveMemory, deleteMemory } from "./actions";

const CATEGORY_KEYS = new Set([
  "party",
  "deadline",
  "convention",
  "fact",
  "preference",
]);

export type MemoryItem = {
  id: string;
  category: string;
  text: string;
  status: string;
  projectName: string;
};

export function MemoryRow({ memory }: { memory: MemoryItem }) {
  const t = useTranslations("settings.memory");
  const [pending, start] = useTransition();
  const approved = memory.status === "approved";

  function run(fn: (id: string) => Promise<void>, ok: string) {
    start(async () => {
      try {
        await fn(memory.id);
        toast.success(ok);
      } catch {
        toast.error(t("toast.error"));
      }
    });
  }

  return (
    <div className="flex items-start gap-3 px-4 py-3 border-b last:border-b-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="outline" className="text-[10px] shrink-0">
            {CATEGORY_KEYS.has(memory.category)
              ? t(`category.${memory.category}`)
              : memory.category}
          </Badge>
          <span className="text-xs text-muted-foreground truncate">
            {memory.projectName}
          </span>
        </div>
        <p className="text-sm">{memory.text}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {approved ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => run(unapproveMemory, t("toast.unapproved"))}
            title={t("unapproveTitle")}
          >
            <IconArrowBackUp className="size-4" />
          </Button>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => run(approveMemory, t("toast.approved"))}
            title={t("approveTitle")}
          >
            <IconCheck className="size-4 text-success" />
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => run(deleteMemory, t("toast.deleted"))}
          title={t("deleteTitle")}
        >
          <IconTrash className="size-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
}
