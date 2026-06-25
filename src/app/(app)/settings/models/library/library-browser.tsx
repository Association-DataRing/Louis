"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  IconBooks,
  IconCheck,
  IconLoader2,
  IconRefresh,
  IconSearch,
  IconExternalLink,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { PROVIDER_CATALOG, type ProviderType } from "@/lib/providers/catalog";
import { ProviderQuickAdd } from "@/components/provider-quick-add";
import { MODEL_PRICING } from "@/lib/providers/pricing";

/** H23 : prix par M de tokens (entrée/sortie) pour signaler le coût AVANT
 * d'activer un modèle. « prix inconnu » plutôt qu'un faux « gratuit ». */
function formatModelPrice(modelId: string): string {
  const p = MODEL_PRICING[modelId];
  if (!p) return "prix inconnu";
  const sym = p.currency === "EUR" ? "€" : "$";
  return `${p.inputPerMillion} / ${p.outputPerMillion} ${sym}/M`;
}
import type { LiveModel } from "@/lib/providers/live-catalog";
import { addModelsBulk } from "../actions";

interface LibraryBrowserProps {
  providerKeys: Array<{
    id: string;
    label: string;
    type: ProviderType;
  }>;
  /** Set "providerType:modelId" des modèles déjà ajoutés. */
  enabledKeys: string[];
}

type FetchState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; models: LiveModel[] }
  | { kind: "error"; message: string };

export function LibraryBrowser({
  providerKeys,
  enabledKeys,
}: LibraryBrowserProps) {
  const router = useRouter();
  const [selectedKeyId, setSelectedKeyId] = useState<string>(
    providerKeys[0]?.id ?? ""
  );
  const [search, setSearch] = useState("");
  const [state, setState] = useState<FetchState>({ kind: "idle" });
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [saving, startSaving] = useTransition();

  const enabledSet = useMemo(() => new Set(enabledKeys), [enabledKeys]);
  const selectedKey = providerKeys.find((k) => k.id === selectedKeyId);
  const providerType = selectedKey?.type;

  const loadModels = useMemo(
    () => async (keyId: string) => {
      setState({ kind: "loading" });
      setSelection(new Set());
      try {
        const res = await fetch(`/api/providers/${keyId}/models`, {
          cache: "no-store",
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          setState({
            kind: "error",
            message: body?.error ?? `Erreur HTTP ${res.status}`,
          });
          return;
        }
        const data = (await res.json()) as {
          providerType: ProviderType;
          models: LiveModel[];
        };
        setState({ kind: "ready", models: data.models });
      } catch (err) {
        setState({
          kind: "error",
          message: err instanceof Error ? err.message : "Erreur réseau",
        });
      }
    },
    []
  );

  // Auto-fetch dès qu'on a une clé sélectionnée. loadModels appelle
  // setState mais c'est intentionnel (chargement asynchrone, pattern
  // recommandé par React docs pour les data fetches dans useEffect).
  useEffect(() => {
    if (selectedKeyId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadModels(selectedKeyId);
    }
  }, [selectedKeyId, loadModels]);

  const filtered = useMemo(() => {
    if (state.kind !== "ready") return [];
    // Belt-and-braces : dédup côté client au cas où un futur provider
    // renvoie des doublons (Mistral l'a fait avec mistral-large-latest
    // / mistral-large-2512 partageant la même id apparemment).
    const seen = new Set<string>();
    const unique = state.models.filter((m) => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });
    if (!search.trim()) return unique;
    const q = search.trim().toLowerCase();
    return unique.filter(
      (m) =>
        m.id.toLowerCase().includes(q) ||
        m.label.toLowerCase().includes(q) ||
        (m.hint ?? "").toLowerCase().includes(q) ||
        (m.vendor ?? "").toLowerCase().includes(q)
    );
  }, [state, search]);

  function isAlreadyAdded(modelId: string): boolean {
    return providerType
      ? enabledSet.has(`${providerType}:${modelId}`)
      : false;
  }

  function toggleSelection(modelId: string) {
    setSelection((s) => {
      const next = new Set(s);
      if (next.has(modelId)) next.delete(modelId);
      else next.add(modelId);
      return next;
    });
  }

  function selectAll() {
    if (state.kind !== "ready") return;
    setSelection(
      new Set(
        filtered
          .filter((m) => !isAlreadyAdded(m.id))
          .map((m) => m.id)
      )
    );
  }

  function clearSelection() {
    setSelection(new Set());
  }

  function handleSave() {
    if (state.kind !== "ready" || !providerType || selection.size === 0)
      return;
    const models = state.models
      .filter((m) => selection.has(m.id))
      .map((m) => ({
        modelId: m.id,
        label: m.label,
        hint: m.hint ?? null,
      }));
    startSaving(async () => {
      const result = await addModelsBulk({ providerType, models });
      if (result.ok) {
        toast.success(
          `${models.length} modèle${models.length > 1 ? "s" : ""} ajouté${models.length > 1 ? "s" : ""}`,
          { description: `${PROVIDER_CATALOG[providerType].label}` }
        );
        setSelection(new Set());
        router.refresh();
      } else {
        toast.error("Ajout impossible", { description: result.error });
      }
    });
  }

  if (providerKeys.length === 0) {
    return <NoProviderState />;
  }

  return (
    <div className="space-y-4">
      {/* Provider selector */}
      <div className="rounded-xl border border-border bg-card/30 p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-xs text-foreground/70 uppercase tracking-wider">
              Provider
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Choisissez la clé pour interroger son catalogue live.
            </p>
          </div>
          <Select value={selectedKeyId} onValueChange={setSelectedKeyId}>
            <SelectTrigger className="h-9 min-w-[260px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {providerKeys.map((k) => (
                <SelectItem key={k.id} value={k.id}>
                  {PROVIDER_CATALOG[k.type].label} · {k.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {selectedKey && (
          <div className="mt-3 pt-3 border-t border-border/60 flex items-center gap-2 text-[11px] text-muted-foreground">
            <span>
              <strong className="text-foreground">
                {PROVIDER_CATALOG[selectedKey.type].label}
              </strong>{" "}
              · clé «{" "}
              <span className="font-mono">{selectedKey.label}</span> »
            </span>
            <a
              href={PROVIDER_CATALOG[selectedKey.type].docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 hover:text-foreground transition-colors ml-auto"
            >
              <IconExternalLink className="size-3" />
              docs
            </a>
          </div>
        )}
      </div>

      {/* Search + actions toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[240px]">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom, id, vendor…"
            className="pl-9 h-9"
            disabled={state.kind !== "ready"}
          />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => selectedKeyId && loadModels(selectedKeyId)}
          disabled={state.kind === "loading"}
        >
          <IconRefresh
            className={cn(
              "size-3.5",
              state.kind === "loading" && "animate-spin"
            )}
          />
          Rafraîchir
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={selectAll}
          disabled={state.kind !== "ready"}
        >
          Tout cocher
        </Button>
        {selection.size > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearSelection}
          >
            Décocher ({selection.size})
          </Button>
        )}
      </div>

      {/* Body */}
      {state.kind === "idle" && (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Sélectionnez un provider pour voir son catalogue.
        </div>
      )}

      {state.kind === "loading" && (
        <div className="rounded-xl border border-border p-8 text-center text-sm text-muted-foreground">
          <IconLoader2 className="inline-block size-4 animate-spin mr-2" />
          Récupération du catalogue…
        </div>
      )}

      {state.kind === "error" && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <p className="font-medium text-foreground">
            Impossible de récupérer le catalogue.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {state.message}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => selectedKeyId && loadModels(selectedKeyId)}
          >
            <IconRefresh className="size-3.5" />
            Réessayer
          </Button>
        </div>
      )}

      {state.kind === "ready" && (
        <>
          <div className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground flex items-center justify-between gap-2 flex-wrap">
            <span>
              <strong className="text-foreground">
                {state.models.length}
              </strong>{" "}
              modèle{state.models.length > 1 ? "s" : ""} retourné
              {state.models.length > 1 ? "s" : ""} par l&apos;API de{" "}
              {providerType
                ? PROVIDER_CATALOG[providerType].label
                : "ce provider"}
              {search.trim() && (
                <>
                  {" "}
                  · <strong className="text-foreground">{filtered.length}</strong>{" "}
                  après filtre
                </>
              )}
            </span>
            {selection.size > 0 && (
              <span>
                <strong className="text-foreground">{selection.size}</strong>{" "}
                sélectionné{selection.size > 1 ? "s" : ""}
              </span>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card/50 overflow-hidden">
            {filtered.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">
                Aucun modèle ne correspond à votre recherche.
              </p>
            ) : (
              <ul className="divide-y divide-border max-h-[600px] overflow-y-auto">
                {filtered.map((m) => {
                  const added = isAlreadyAdded(m.id);
                  const checked = selection.has(m.id);
                  return (
                    <li
                      key={m.id}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3",
                        added && "bg-muted/30 opacity-70"
                      )}
                    >
                      {added ? (
                        <span
                          className="size-4 rounded-sm bg-foreground/10 grid place-items-center shrink-0"
                          aria-label="Déjà ajouté"
                        >
                          <IconCheck className="size-3" />
                        </span>
                      ) : (
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggleSelection(m.id)}
                          aria-label={`Sélectionner ${m.label}`}
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="text-sm font-medium">{m.label}</span>
                          <code className="text-[11px] text-muted-foreground font-mono">
                            {m.id}
                          </code>
                          <span
                            className="text-[10px] text-muted-foreground tabular-nums"
                            title="Prix par million de tokens (entrée / sortie)"
                          >
                            {formatModelPrice(m.id)}
                          </span>
                          {added && (
                            <span className="text-[10px] uppercase tracking-wider text-foreground/70">
                              · déjà ajouté
                            </span>
                          )}
                        </div>
                        {m.hint && (
                          <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-1">
                            {m.hint}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Sticky save bar */}
          {selection.size > 0 && (
            <div className="sticky bottom-4 z-20 flex items-center justify-between gap-3 rounded-xl border border-border bg-card/95 backdrop-blur shadow-lg px-4 py-3">
              <div className="text-sm">
                <span className="font-medium text-foreground">
                  {selection.size} modèle{selection.size > 1 ? "s" : ""}
                </span>{" "}
                <span className="text-muted-foreground">
                  prêt{selection.size > 1 ? "s" : ""} à être ajouté
                  {selection.size > 1 ? "s" : ""}.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearSelection}
                  disabled={saving}
                >
                  Annuler
                </Button>
                <Button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? "Ajout…" : "Ajouter à ma plateforme"}
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function NoProviderState() {
  return (
    <div className="py-12 border-y border-dashed border-border text-center">
      <IconBooks className="size-8 mx-auto text-muted-foreground" />
      <p className="mt-3 font-heading text-2xl tracking-tight">
        Configurez d&apos;abord un provider.
      </p>
      <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
        La bibliothèque interroge l&apos;API de vos providers pour vous
        montrer leurs modèles disponibles.
      </p>
      <div className="mt-6 flex justify-center">
        <ProviderQuickAdd />
      </div>
    </div>
  );
}
