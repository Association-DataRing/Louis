"use client";

import { useState, useMemo } from "react";
import { IconSearch } from "@tabler/icons-react";
import { ConversationItem } from "./conversation-item";

type Conversation = {
  id: string;
  title: string;
};

type Props = {
  conversations: Conversation[];
  currentId?: string;
};

export function ConversationsList({ conversations, currentId }: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => c.title.toLowerCase().includes(q));
  }, [conversations, query]);

  if (conversations.length === 0) {
    return (
      <p className="text-xs text-muted-foreground p-3">
        Vos conversations apparaîtront ici.
      </p>
    );
  }

  return (
    <>
      <div className="px-2 pt-2 pb-1">
        <div className="relative">
          <IconSearch className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher…"
            className="w-full rounded-md border border-input bg-background pl-7 pr-2 py-1.5 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          />
        </div>
      </div>
      <div className="space-y-0.5 px-2 pb-2">
        {filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground p-3 text-center">
            Aucun résultat.
          </p>
        ) : (
          filtered.map((c) => (
            <ConversationItem
              key={c.id}
              id={c.id}
              title={c.title}
              isCurrent={c.id === currentId}
            />
          ))
        )}
      </div>
    </>
  );
}
