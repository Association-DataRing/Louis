"use client";

import { useTransition } from "react";
import {
  IconCheck,
  IconAlertTriangle,
  IconCircleDashed,
  IconDots,
  IconTrash,
} from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CATEGORY_LABEL,
  CONNECTOR_CATALOG,
} from "@/lib/connectors/catalog";
import type { ConnectorKey } from "@/db/schema/connector-keys";
import {
  deleteConnectorKey,
  toggleConnectorKeyActive,
} from "./actions";

export function ConnectorRow({ entry }: { entry: ConnectorKey }) {
  const [pending, startTransition] = useTransition();
  const meta = CONNECTOR_CATALOG[entry.type];
  const Icon = meta.icon;

  return (
    <div className="px-5 py-4 flex items-center gap-4">
      <div className="shrink-0 size-10 rounded-md bg-muted flex items-center justify-center text-foreground">
        <Icon className="size-5" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium truncate">{entry.label}</span>
          <Badge variant="outline" className="shrink-0 text-[10px]">
            {CATEGORY_LABEL[meta.category]}
          </Badge>
          <TestBadge status={entry.lastTestStatus} />
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {meta.label} · Débloque : {meta.unlocks.join(" · ")}
        </div>
      </div>

      <Switch
        checked={entry.isActive}
        disabled={pending}
        onCheckedChange={() => {
          startTransition(() => toggleConnectorKeyActive(entry.id));
        }}
        aria-label="Activer ce connecteur"
      />

      <DropdownMenu>
        <DropdownMenuTrigger
          className="size-8 inline-flex items-center justify-center rounded-md hover:bg-accent transition-colors"
          aria-label="Actions"
        >
          <IconDots className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            variant="destructive"
            disabled={pending}
            onSelect={() => {
              if (confirm(`Supprimer "${entry.label}" ?`)) {
                startTransition(() => deleteConnectorKey(entry.id));
              }
            }}
          >
            <IconTrash className="size-4" />
            Supprimer
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function TestBadge({ status }: { status: string | null }) {
  if (!status) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
        <IconCircleDashed className="size-3" />
        non testé
      </span>
    );
  }
  if (status === "ok") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400">
        <IconCheck className="size-3" />
        connecté
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-destructive">
      <IconAlertTriangle className="size-3" />
      erreur
    </span>
  );
}
