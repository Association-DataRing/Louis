"use client";

import { useTransition } from "react";
import {
  IconCheck,
  IconAlertTriangle,
  IconCircleDashed,
  IconDots,
  IconStar,
  IconStarFilled,
  IconTrash,
  IconPlayerPlay,
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
import { PROVIDER_CATALOG, SOVEREIGNTY_LABEL } from "@/lib/providers/catalog";
import type { ProviderKey } from "@/db/schema/provider-keys";
import {
  deleteProviderKey,
  setProviderKeyDefault,
  testProviderKey,
  toggleProviderKeyActive,
} from "./actions";

export function ProviderRow({ entry }: { entry: ProviderKey }) {
  const [pending, startTransition] = useTransition();
  const meta = PROVIDER_CATALOG[entry.type];
  const Icon = meta.icon;

  const sovereigntyVariant =
    meta.sovereignty === "fr"
      ? "default"
      : meta.sovereignty === "eu"
        ? "secondary"
        : "outline";

  return (
    <div className="px-5 py-4 flex items-center gap-4">
      <div className="shrink-0 size-10 rounded-md bg-muted flex items-center justify-center text-foreground">
        <Icon className="size-5" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{entry.label}</span>
          <Badge variant={sovereigntyVariant} className="shrink-0 text-[10px]">
            {SOVEREIGNTY_LABEL[meta.sovereignty]}
          </Badge>
          {entry.isDefault && (
            <Badge variant="outline" className="shrink-0 text-[10px]">
              <IconStarFilled className="size-2.5 mr-1" />
              Défaut
            </Badge>
          )}
          <TestBadge status={entry.lastTestStatus} />
        </div>
        <div className="text-xs text-muted-foreground mt-0.5 truncate">
          {meta.label}
          {entry.baseUrl && ` · ${entry.baseUrl}`}
        </div>
      </div>

      <Switch
        checked={entry.isActive}
        disabled={pending}
        onCheckedChange={() => {
          startTransition(() => toggleProviderKeyActive(entry.id));
        }}
        aria-label="Activer ce provider"
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
            disabled={pending || !meta.testBaseUrl}
            onSelect={() => {
              startTransition(() => testProviderKey(entry.id));
            }}
          >
            <IconPlayerPlay className="size-4" />
            Tester la connexion
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={pending || entry.isDefault}
            onSelect={() => {
              startTransition(() => setProviderKeyDefault(entry.id));
            }}
          >
            <IconStar className="size-4" />
            Définir par défaut
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            disabled={pending}
            onSelect={() => {
              if (confirm(`Supprimer "${entry.label}" ?`)) {
                startTransition(() => deleteProviderKey(entry.id));
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
  if (status === "skipped") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
        <IconCircleDashed className="size-3" />
        test indisponible
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-destructive">
      <IconAlertTriangle className="size-3" />
      {status === "auth_error" ? "auth invalide" : "erreur réseau"}
    </span>
  );
}
