"use client";

import { useTransition } from "react";
import {
  IconBolt,
  IconCheck,
  IconAlertTriangle,
  IconCircleDashed,
  IconDots,
  IconRefresh,
  IconTrash,
} from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { McpServer } from "@/db/schema/mcp-servers";
import {
  deleteMcpServer,
  syncMcpServer,
  toggleMcpServerActive,
} from "./actions";

export function McpRow({ entry }: { entry: McpServer }) {
  const [pending, startTransition] = useTransition();
  const toolCount = entry.toolsJson?.length ?? 0;

  return (
    <div className="px-5 py-4 flex items-center gap-4">
      <div className="shrink-0 size-10 rounded-md bg-muted flex items-center justify-center text-foreground">
        <IconBolt className="size-5" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium truncate">{entry.label}</span>
          <Badge variant="outline" className="shrink-0 text-[10px] uppercase">
            {entry.transport}
          </Badge>
          {toolCount > 0 ? (
            <Badge variant="default" className="shrink-0 text-[10px]">
              {toolCount} outil{toolCount > 1 ? "s" : ""}
            </Badge>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <IconCircleDashed className="size-3" />
              non synchronisé
            </span>
          )}
          {entry.lastSyncError && (
            <span className="inline-flex items-center gap-1 text-[10px] text-destructive">
              <IconAlertTriangle className="size-3" />
              erreur de sync
            </span>
          )}
          {!entry.lastSyncError && entry.lastSyncedAt && toolCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] text-success">
              <IconCheck className="size-3" />
              synchronisé
            </span>
          )}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5 truncate font-mono">
          {entry.url}
        </div>
        {entry.lastSyncError && (
          <div className="text-xs text-destructive mt-1 truncate">
            {entry.lastSyncError}
          </div>
        )}
      </div>

      <Switch
        checked={entry.isActive}
        disabled={pending}
        onCheckedChange={() => {
          startTransition(() => toggleMcpServerActive(entry.id));
        }}
        aria-label="Activer ce serveur"
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
            disabled={pending}
            onSelect={() => {
              startTransition(() => syncMcpServer(entry.id));
            }}
          >
            <IconRefresh className="size-4" />
            Synchroniser les outils
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            disabled={pending}
            onSelect={() => {
              if (confirm(`Supprimer "${entry.label}" ?`)) {
                startTransition(() => deleteMcpServer(entry.id));
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
