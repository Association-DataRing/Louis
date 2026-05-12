"use client";

import { useState, useTransition } from "react";
import {
  IconDots,
  IconKey,
  IconUserCheck,
  IconUserOff,
  IconTrash,
  IconShield,
} from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  deleteUser,
  resetUserPassword,
  toggleUserActive,
} from "./actions";
import type { UserRole } from "@/db/schema/users";

type Entry = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  lastLogin: Date | null;
  createdAt: Date;
};

export function UserRow({
  entry,
  currentUserId,
}: {
  entry: Entry;
  currentUserId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const isSelf = entry.id === currentUserId;

  async function handleResetPassword() {
    const next = prompt(
      `Nouveau mot de passe pour ${entry.email}\n(min. 10 caractères)`
    );
    if (!next) return;
    const trimmed = next.trim();
    if (trimmed.length < 10) {
      setFeedback("Trop court — 10 caractères minimum.");
      return;
    }
    startTransition(async () => {
      const result = await resetUserPassword(entry.id, trimmed);
      setFeedback(
        result.ok
          ? `Mot de passe réinitialisé pour ${entry.email}`
          : result.error
      );
      window.setTimeout(() => setFeedback(null), 4000);
    });
  }

  return (
    <div className="px-5 py-4 flex items-center gap-4">
      <div className="shrink-0 size-9 rounded-full bg-muted flex items-center justify-center text-foreground font-medium text-sm">
        {entry.name.slice(0, 1).toUpperCase()}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium truncate">{entry.name}</span>
          {entry.role === "admin" && (
            <Badge variant="default" className="text-[10px] gap-1">
              <IconShield className="size-2.5" />
              Admin
            </Badge>
          )}
          {!entry.isActive && (
            <Badge variant="outline" className="text-[10px]">
              désactivé
            </Badge>
          )}
          {isSelf && (
            <Badge variant="secondary" className="text-[10px]">
              vous
            </Badge>
          )}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5 truncate">
          {entry.email}
          {entry.lastLogin
            ? ` · dernière connexion ${new Date(entry.lastLogin).toLocaleDateString("fr-FR")}`
            : " · jamais connecté"}
        </div>
        {feedback && (
          <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
            {feedback}
          </div>
        )}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger
          className="size-8 inline-flex items-center justify-center rounded-md hover:bg-accent transition-colors disabled:opacity-50"
          aria-label="Actions"
          disabled={isSelf || pending}
        >
          <IconDots className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={handleResetPassword}>
            <IconKey className="size-4" />
            Réinitialiser le mot de passe
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              startTransition(() => toggleUserActive(entry.id));
            }}
          >
            {entry.isActive ? (
              <>
                <IconUserOff className="size-4" />
                Désactiver
              </>
            ) : (
              <>
                <IconUserCheck className="size-4" />
                Activer
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => {
              if (
                confirm(
                  `Supprimer ${entry.email} ? Toutes ses données (providers, connecteurs, conversations, documents) seront perdues.`
                )
              ) {
                startTransition(() => deleteUser(entry.id));
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
