"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  IconBookmarks,
  IconCheck,
  IconDownload,
  IconInfoCircle,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { importSkillTemplate } from "./actions";

interface Template {
  slug: string;
  name: string;
  description: string;
  triggerHint: string;
  systemPrompt: string;
  alreadyImported: boolean;
}

interface Props {
  templates: Template[];
}

export function SkillTemplatesDialog({ templates }: Props) {
  const router = useRouter();
  const t = useTranslations("settings.skills");
  const [open, setOpen] = useState(false);
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function handleImport(slug: string, name: string) {
    setBusySlug(slug);
    startTransition(async () => {
      const result = await importSkillTemplate(slug);
      setBusySlug(null);
      if (result.ok) {
        toast.success(t("toast.imported"), {
          description: t("toast.importedDescription", { name }),
        });
        router.refresh();
      } else {
        toast.error(t("toast.importError"), { description: result.error });
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <IconBookmarks className="size-4" />
          {t("templates.trigger")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">
            {t("templates.heading")}
          </DialogTitle>
          <DialogDescription>
            {t("templates.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="mb-3 rounded-lg border border-warning/30 bg-warning/5 p-3 flex items-start gap-2 text-sm">
          <IconInfoCircle className="size-4 text-warning shrink-0 mt-0.5" />
          <p className="text-muted-foreground">
            {t.rich("templates.warning", {
              strong: (chunks) => <strong>{chunks}</strong>,
            })}
          </p>
        </div>

        <ul className="space-y-3">
          {templates.map((tpl) => (
            <li
              key={tpl.slug}
              className="rounded-lg border border-border bg-card/50 p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{tpl.name}</span>
                    <code className="text-[11px] text-muted-foreground font-mono">
                      {tpl.slug}
                    </code>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {tpl.description}
                  </p>
                  <p className="mt-1.5 text-[11px] text-muted-foreground/80 italic">
                    <span className="not-italic font-medium">
                      {t("templates.triggerLabel")}
                    </span>{" "}
                    {tpl.triggerHint}
                  </p>
                </div>
                {tpl.alreadyImported ? (
                  <Button variant="ghost" size="sm" disabled>
                    <IconCheck className="size-4" />
                    {t("templates.imported")}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busySlug === tpl.slug}
                    onClick={() => handleImport(tpl.slug, tpl.name)}
                  >
                    <IconDownload className="size-4" />
                    {busySlug === tpl.slug
                      ? t("templates.importing")
                      : t("templates.import")}
                  </Button>
                )}
              </div>
              <details className="mt-3">
                <summary className="text-[11px] text-muted-foreground cursor-pointer hover:text-foreground">
                  {t("templates.viewPrompt")}
                </summary>
                <pre className="mt-2 text-[11px] font-mono leading-relaxed bg-muted/30 rounded p-2 max-h-40 overflow-y-auto whitespace-pre-wrap">
                  {tpl.systemPrompt}
                </pre>
              </details>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
