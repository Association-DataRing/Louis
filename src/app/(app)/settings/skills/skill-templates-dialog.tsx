"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
  const [open, setOpen] = useState(false);
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function handleImport(slug: string, name: string) {
    setBusySlug(slug);
    startTransition(async () => {
      const result = await importSkillTemplate(slug);
      setBusySlug(null);
      if (result.ok) {
        toast.success("Compétence importée", {
          description: `${name} — éditable dans votre liste`,
        });
        router.refresh();
      } else {
        toast.error("Import impossible", { description: result.error });
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <IconBookmarks className="size-4" />
          Bibliothèque d&apos;exemples
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">
            Bibliothèque d&apos;exemples
          </DialogTitle>
          <DialogDescription>
            Sept exemples de compétences juridiques pour démarrer. Importez ceux
            qui vous intéressent — vous pourrez ensuite les éditer ou les
            supprimer librement.
          </DialogDescription>
        </DialogHeader>

        <div className="mb-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 flex items-start gap-2 text-sm">
          <IconInfoCircle className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-muted-foreground">
            Ces exemples sont fournis comme <strong>points de départ</strong>.
            Relisez-les et adaptez-les à la pratique de votre cabinet — Louis
            n&apos;impose jamais de prompt préconfiguré.
          </p>
        </div>

        <ul className="space-y-3">
          {templates.map((t) => (
            <li
              key={t.slug}
              className="rounded-lg border border-border bg-card/50 p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{t.name}</span>
                    <code className="text-[11px] text-muted-foreground font-mono">
                      {t.slug}
                    </code>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t.description}
                  </p>
                  <p className="mt-1.5 text-[11px] text-muted-foreground/80 italic">
                    <span className="not-italic font-medium">Activée quand :</span>{" "}
                    {t.triggerHint}
                  </p>
                </div>
                {t.alreadyImported ? (
                  <Button variant="ghost" size="sm" disabled>
                    <IconCheck className="size-4" />
                    Importée
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busySlug === t.slug}
                    onClick={() => handleImport(t.slug, t.name)}
                  >
                    <IconDownload className="size-4" />
                    {busySlug === t.slug ? "Import…" : "Importer"}
                  </Button>
                )}
              </div>
              <details className="mt-3">
                <summary className="text-[11px] text-muted-foreground cursor-pointer hover:text-foreground">
                  Voir l&apos;instruction système
                </summary>
                <pre className="mt-2 text-[11px] font-mono leading-relaxed bg-muted/30 rounded p-2 max-h-40 overflow-y-auto whitespace-pre-wrap">
                  {t.systemPrompt}
                </pre>
              </details>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
