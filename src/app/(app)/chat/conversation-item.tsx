"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  IconMessageCircle,
  IconDots,
  IconPencil,
  IconTrash,
} from "@tabler/icons-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { renameConversation, deleteConversation } from "./actions";

type Props = {
  id: string;
  title: string;
  isCurrent: boolean;
};

export function ConversationItem({ id, title, isCurrent }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  function commitRename() {
    setEditing(false);
    const next = draft.trim();
    if (!next || next === title) {
      setDraft(title);
      return;
    }
    startTransition(async () => {
      await renameConversation(id, next);
    });
  }

  function handleDelete() {
    if (!confirm(`Supprimer la conversation "${title}" ?`)) return;
    startTransition(async () => {
      await deleteConversation(id, { redirectToFresh: isCurrent });
      if (!isCurrent) router.refresh();
    });
  }

  if (editing) {
    return (
      <div className="px-2.5 py-1 rounded-md bg-accent">
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitRename();
            if (e.key === "Escape") {
              setDraft(title);
              setEditing(false);
            }
          }}
          autoFocus
          className="w-full bg-transparent text-sm outline-none"
        />
      </div>
    );
  }

  return (
    <div
      className={`group flex items-center gap-1 rounded-md text-sm transition-colors ${
        isCurrent ? "bg-accent text-accent-foreground" : "hover:bg-accent/60"
      } ${pending ? "opacity-50" : ""}`}
    >
      <Link
        href={`/chat?id=${id}`}
        className="flex-1 flex items-center gap-2 px-2.5 py-2 min-w-0"
      >
        <IconMessageCircle className="size-3.5 shrink-0 opacity-60" />
        <span className="truncate">{title}</span>
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="shrink-0 size-7 inline-flex items-center justify-center rounded-md opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100 hover:bg-background/60 transition-opacity mr-1"
          aria-label="Actions"
        >
          <IconDots className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() => {
              setDraft(title);
              setEditing(true);
              requestAnimationFrame(() => inputRef.current?.focus());
            }}
          >
            <IconPencil className="size-4" />
            Renommer
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={handleDelete}>
            <IconTrash className="size-4" />
            Supprimer
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
