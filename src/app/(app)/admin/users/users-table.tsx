"use client";

import { useMemo, useState } from "react";
import { IconSearch } from "@tabler/icons-react";
import { UserRow, type UserEntryWithStats } from "./user-row";

type Props = {
  rows: UserEntryWithStats[];
  currentUserId: string;
  /**
   * Timestamp "now" propagé depuis le server component — calculer
   * `Date.now()` directement dans un composant client viole la règle
   * `react-hooks/purity` de React Compiler. Une valeur stable côté render
   * suffit largement pour le filtre "dormant > 30j".
   */
  nowMs: number;
};

const DORMANT_DAYS = 30;
const DORMANT_THRESHOLD_MS = DORMANT_DAYS * 24 * 60 * 60 * 1000;

type Filter = "all" | "admin" | "inactive" | "dormant";

const FILTER_LABELS: Record<Filter, string> = {
  all: "Tous",
  admin: "Admins",
  inactive: "Inactifs",
  dormant: `Dormants > ${DORMANT_DAYS} j`,
};

/**
 * Vue tableau filtrable des utilisateurs. Search côté client sur
 * email + nom (volume cabinet typique = 5-30 users, pas besoin de
 * pagination), filter chips pour les sous-ensembles courants.
 */
export function UsersTable({ rows, currentUserId, nowMs }: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = useMemo(() => {
    const now = nowMs;
    const q = query.trim().toLowerCase();
    return rows.filter((u) => {
      if (q) {
        const haystack = `${u.name} ${u.email}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (filter === "admin" && u.role !== "admin") return false;
      if (filter === "inactive" && u.isActive) return false;
      if (filter === "dormant") {
        const last = u.stats.lastActivity
          ? new Date(u.stats.lastActivity).getTime()
          : u.lastLogin
            ? new Date(u.lastLogin).getTime()
            : new Date(u.createdAt).getTime();
        if (now - last < DORMANT_THRESHOLD_MS) return false;
      }
      return true;
    });
  }, [rows, query, filter, nowMs]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[240px]">
          <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher par email ou nom…"
            className="w-full rounded-md border border-input bg-background pl-8 pr-3 py-1.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          />
        </div>
        <div className="flex items-center gap-1">
          {(Object.keys(FILTER_LABELS) as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1.5 rounded-md text-xs transition-colors ${
                filter === f
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
            >
              {FILTER_LABELS[f]}
            </button>
          ))}
        </div>
      </div>

      <div className="text-xs text-muted-foreground mb-3">
        {filtered.length} résultat{filtered.length > 1 ? "s" : ""}
        {filtered.length !== rows.length && ` sur ${rows.length}`}
      </div>

      {filtered.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-10 text-center text-sm text-muted-foreground">
          Aucun utilisateur ne correspond à ce filtre.
        </div>
      ) : (
        <div className="border border-border rounded-lg divide-y divide-border bg-card">
          {filtered.map((u) => (
            <UserRow key={u.id} entry={u} currentUserId={currentUserId} />
          ))}
        </div>
      )}
    </div>
  );
}
