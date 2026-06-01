"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconRefresh } from "@tabler/icons-react";
import { toast } from "sonner";
import { reindexAllDocumentsAction } from "./actions";

/**
 * Réindexe tous les documents de l'utilisateur — recovery typique après
 * l'ajout d'une clé Mistral suite à des imports non indexés.
 */
export function ReindexAllButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      const r = await reindexAllDocumentsAction();
      if (r.noKey && r.indexed === 0) {
        toast.error("Aucune clé Mistral active — impossible d'indexer.");
      } else if (r.failed > 0) {
        toast.warning(
          `${r.indexed} document(s) indexé(s), ${r.failed} en échec.`
        );
      } else {
        toast.success(`${r.indexed} document(s) réindexé(s).`);
      }
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={run}
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 h-9 text-sm hover:bg-accent transition-colors disabled:opacity-50"
      title="Réindexer tous les documents pour la recherche sémantique (RAG)"
    >
      <IconRefresh className={`size-4 ${pending ? "animate-spin" : ""}`} />
      <span className="hidden sm:inline">Réindexer</span>
    </button>
  );
}
