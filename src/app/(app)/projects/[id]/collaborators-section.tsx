"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { IconUsers, IconUserPlus, IconX } from "@tabler/icons-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  addProjectCollaborator,
  removeProjectCollaborator,
} from "../actions";

export type Collaborator = {
  userId: string;
  name: string;
  email: string;
};

export type AddableUser = { id: string; name: string; email: string };

type Props = {
  projectId: string;
  ownerName: string;
  ownerEmail: string;
  collaborators: Collaborator[];
  addableUsers: AddableUser[];
  /** Affiche les contrôles d'ajout/retrait (propriétaire ou admin). */
  canManage: boolean;
};

export function CollaboratorsSection({
  projectId,
  ownerName,
  ownerEmail,
  collaborators,
  addableUsers,
  canManage,
}: Props) {
  const router = useRouter();
  const t = useTranslations("projects.collaborators");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleAdd(userId: string) {
    setError(null);
    startTransition(async () => {
      const r = await addProjectCollaborator(projectId, userId);
      if (!r.ok) setError(r.error);
      else router.refresh();
    });
  }

  function handleRemove(userId: string) {
    setError(null);
    startTransition(async () => {
      const r = await removeProjectCollaborator(projectId, userId);
      if (!r.ok) setError(r.error);
      else router.refresh();
    });
  }

  return (
    <section className="mt-10">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-heading text-lg tracking-tight inline-flex items-center gap-2">
          <IconUsers className="size-4 text-muted-foreground" />
          {t("heading")}
          <span className="text-xs text-muted-foreground font-normal">
            ({collaborators.length + 1})
          </span>
        </h2>
        {canManage && addableUsers.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger
              disabled={pending}
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline underline-offset-2 disabled:opacity-50"
            >
              <IconUserPlus className="size-3.5" />
              {t("addCollaborator")}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-72 overflow-y-auto">
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                {t("firmAccounts")}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {addableUsers.map((u) => (
                <DropdownMenuItem
                  key={u.id}
                  onSelect={() => handleAdd(u.id)}
                  className="flex-col items-start gap-0.5"
                >
                  <span className="text-sm">{u.name}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {u.email}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {error && (
        <p className="mb-2 text-xs text-destructive">{error}</p>
      )}

      <div className="border border-border rounded-lg bg-card divide-y divide-border">
        {/* Propriétaire */}
        <div className="flex items-center gap-3 px-4 py-3">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-medium text-primary">
            {initials(ownerName)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm truncate">{ownerName}</p>
            <p className="text-[11px] text-muted-foreground truncate">
              {ownerEmail}
            </p>
          </div>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {t("owner")}
          </span>
        </div>

        {/* Collaborateurs */}
        {collaborators.map((c) => (
          <div key={c.userId} className="flex items-center gap-3 px-4 py-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-medium">
              {initials(c.name)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm truncate">{c.name}</p>
              <p className="text-[11px] text-muted-foreground truncate">
                {c.email}
              </p>
            </div>
            {canManage && (
              <button
                type="button"
                onClick={() => handleRemove(c.userId)}
                disabled={pending}
                title={t("removeTitle")}
                aria-label={t("removeAria", { name: c.name })}
                className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-50"
              >
                <IconX className="size-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>

      {collaborators.length === 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          {canManage ? t("emptyManage") : t("emptyReadonly")}
        </p>
      )}
    </section>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}
