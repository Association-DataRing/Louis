"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
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
  const [pending, startTransition] = useTransition();

  function run(onlyUnindexed: boolean) {
    startTransition(async () => {
      const r = await reindexAllDocumentsAction({ onlyUnindexed });
      if (r.noKey && r.indexed === 0 && r.skipped === 0) {
        toast.error("Aucune clé d'embedding active — impossible d'indexer.");
      } else if (r.indexed === 0 && r.skipped > 0) {
        toast.success("Tous les documents sont déjà indexés.");
      } else if (r.failed > 0) {
        toast.warning(
          `${r.indexed} document(s) indexé(s), ${r.failed} en échec.`
        );
      } else {
        toast.success(`${r.indexed} document(s) indexé(s).`);
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
          title="Indexer les documents non encore indexés pour la recherche sémantique (RAG)"
        >
          <IconRefresh className={`size-4 ${pending ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline">Indexer</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => run(true)}>
          Indexer les nouveaux documents
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => run(false)}>
          Tout réindexer (forcer)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
