"use client";

import { useTransition } from "react";
import {
  IconCheck,
  IconArrowBackUp,
  IconTrash,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { approveMemory, unapproveMemory, deleteMemory } from "./actions";

const CATEGORY_LABEL: Record<string, string> = {
  party: "Partie",
  deadline: "Échéance",
  convention: "Convention",
  fact: "Fait",
  preference: "Préférence",
};

export type MemoryItem = {
  id: string;
  category: string;
  text: string;
  status: string;
  projectName: string;
};

export function MemoryRow({ memory }: { memory: MemoryItem }) {
  const [pending, start] = useTransition();
  const approved = memory.status === "approved";

  function run(fn: (id: string) => Promise<void>, ok: string) {
    start(async () => {
      try {
        await fn(memory.id);
        toast.success(ok);
      } catch {
        toast.error("Action impossible.");
      }
    });
  }

  return (
    <div className="flex items-start gap-3 px-4 py-3 border-b last:border-b-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="outline" className="text-[10px] shrink-0">
            {CATEGORY_LABEL[memory.category] ?? memory.category}
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
            onClick={() => run(unapproveMemory, "Fait remis en attente.")}
            title="Remettre en attente"
          >
            <IconArrowBackUp className="size-4" />
          </Button>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => run(approveMemory, "Fait validé.")}
            title="Valider ce fait"
          >
            <IconCheck className="size-4 text-success" />
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => run(deleteMemory, "Fait supprimé.")}
          title="Supprimer"
        >
          <IconTrash className="size-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
}
