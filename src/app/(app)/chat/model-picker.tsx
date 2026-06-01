"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { IconChevronDown, IconAlertCircle, IconCheck } from "@tabler/icons-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  PROVIDER_CATALOG,
  SOVEREIGNTY_LABEL,
  type ProviderType,
} from "@/lib/providers/catalog";

export type ModelEntry = {
  providerType: ProviderType;
  modelId: string;
  label: string;
  hint?: string | null;
};

type Props = {
  /** Format providerType:modelId — identique au selectedModelValue parent. */
  value: string;
  onChange: (next: string) => void;
  models: ModelEntry[];
  /** Types de providers qui ont au moins une clé active chez l'utilisateur. */
  activeProviderTypes: Set<ProviderType>;
  disabled?: boolean;
};

/**
 * Sélecteur de modèle premium — Popover groupé par provider en remplacement
 * du Select shadcn. Format inspiré des assistants legaltech (header
 * provider en uppercase, modèles listés simplement, indicateur d'erreur
 * pour les providers sans clé configurée).
 */
export function ModelPicker({
  value,
  onChange,
  models,
  activeProviderTypes,
  disabled = false,
}: Props) {
  const [open, setOpen] = useState(false);

  // Trouve le modèle sélectionné pour l'afficher dans le trigger.
  const selected = useMemo(
    () => models.find((m) => `${m.providerType}:${m.modelId}` === value),
    [models, value]
  );
  const selectedMeta = selected
    ? PROVIDER_CATALOG[selected.providerType]
    : null;

  // Groupe par providerType, en suivant l'ordre du catalogue (souverains
  // d'abord, agrégateurs / self-hosted en dernier).
  const groups = useMemo(() => {
    const byProvider = new Map<ProviderType, ModelEntry[]>();
    for (const m of models) {
      const list = byProvider.get(m.providerType) ?? [];
      list.push(m);
      byProvider.set(m.providerType, list);
    }
    const catalogOrder = Object.keys(PROVIDER_CATALOG) as ProviderType[];
    return catalogOrder
      .filter((p) => byProvider.has(p))
      .map((p) => ({
        providerType: p,
        meta: PROVIDER_CATALOG[p],
        entries: byProvider.get(p)!,
      }));
  }, [models]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        className="inline-flex items-center gap-2 h-8 rounded-full border border-border/60 bg-background/60 hover:bg-accent px-3 text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed max-w-[320px]"
        aria-label="Modèle"
      >
        {selectedMeta && (
          <span
            className="inline-flex items-center text-[10px] uppercase tracking-wider text-foreground/70 font-medium shrink-0"
            aria-hidden
          >
            {SOVEREIGNTY_LABEL[selectedMeta.sovereignty]}
          </span>
        )}
        <span className="truncate font-medium">
          {selected?.label ?? "Choisir un modèle"}
        </span>
        {selectedMeta && (
          <span className="text-[10px] text-muted-foreground shrink-0">
            · {selectedMeta.label}
          </span>
        )}
        <IconChevronDown
          className={`size-3 text-muted-foreground shrink-0 transition-transform ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden
        />
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        sideOffset={8}
        className="w-[320px] p-1 max-h-[480px] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {groups.map((g) => {
          const isProviderActive = activeProviderTypes.has(g.providerType);
          return (
            <div key={g.providerType} className="mb-2 last:mb-0">
              <div className="px-2.5 pt-2 pb-1 flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                  {g.meta.label}
                </span>
                <span
                  className="text-[10px] uppercase tracking-wider text-foreground/70 font-medium"
                  aria-hidden
                >
                  {SOVEREIGNTY_LABEL[g.meta.sovereignty]}
                </span>
              </div>
              {g.entries.map((m) => {
                const itemValue = `${m.providerType}:${m.modelId}`;
                const isSelected = itemValue === value;
                return (
                  <button
                    key={itemValue}
                    type="button"
                    disabled={!isProviderActive}
                    onClick={() => {
                      if (!isProviderActive) return;
                      onChange(itemValue);
                      setOpen(false);
                    }}
                    className={`w-full flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors ${
                      isSelected
                        ? "bg-accent text-accent-foreground"
                        : isProviderActive
                          ? "hover:bg-accent/60"
                          : "opacity-60"
                    }`}
                  >
                    <span className="flex-1 truncate">{m.label}</span>
                    {m.hint && (
                      <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                        {m.hint}
                      </span>
                    )}
                    {isSelected && (
                      <IconCheck className="size-3.5 text-primary shrink-0" />
                    )}
                  </button>
                );
              })}
              {!isProviderActive && (
                <Link
                  href="/settings/providers"
                  onClick={() => setOpen(false)}
                  className="mt-0.5 mx-1 flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] text-destructive hover:bg-destructive/5 transition-colors"
                >
                  <IconAlertCircle className="size-3 shrink-0" />
                  Aucune clé active —{" "}
                  <span className="underline underline-offset-2">
                    configurer
                  </span>
                </Link>
              )}
            </div>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
