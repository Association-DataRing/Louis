"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconAlertTriangle } from "@tabler/icons-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { PipelineAgent, ProviderKey } from "@/db/schema";
import { MODEL_CATALOG } from "@/lib/providers/models";
import { roleMeta } from "./agent-role-meta";
import { updatePipelineAgent } from "./actions";

interface AgentEditSheetProps {
  agent: PipelineAgent;
  providerKeys: Pick<ProviderKey, "id" | "label" | "type">[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const NONE_VALUE = "__none__";

/**
 * Sheet d'édition d'un agent d'une pipeline. Permet de réassigner la
 * clé provider, choisir le modèle, surcharger le system prompt et la
 * tool-allowlist. Le rôle n'est pas modifiable (changer de rôle = créer
 * un nouvel agent et supprimer l'ancien — refactor majeur de la pipeline).
 */
export function AgentEditSheet({
  agent,
  providerKeys,
  open,
  onOpenChange,
}: AgentEditSheetProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [label, setLabel] = useState(agent.label);
  const [providerKeyId, setProviderKeyId] = useState<string>(
    agent.providerKeyId ?? NONE_VALUE
  );
  const [modelOverride, setModelOverride] = useState(agent.modelOverride ?? "");
  const [systemPrompt, setSystemPrompt] = useState(agent.systemPrompt ?? "");
  const [toolAllowlistRaw, setToolAllowlistRaw] = useState(
    serializeAllowlist(agent.toolAllowlist)
  );

  const meta = roleMeta(agent.role);
  const Icon = meta.icon;
  const selectedKey = providerKeys.find((k) => k.id === providerKeyId);
  const modelOptions = selectedKey ? MODEL_CATALOG[selectedKey.type] : [];

  function handleSave() {
    setError(null);

    const parsed = parseAllowlist(toolAllowlistRaw);
    if (parsed === "invalid") {
      setError("Liste d'outils invalide. Format attendu : noms séparés par des virgules.");
      return;
    }

    startTransition(async () => {
      const result = await updatePipelineAgent(agent.id, {
        label: label.trim() || agent.label,
        providerKeyId: providerKeyId === NONE_VALUE ? null : providerKeyId,
        modelOverride: modelOverride.trim() || null,
        systemPrompt: systemPrompt.trim() ? systemPrompt : null,
        toolAllowlist: parsed,
      });
      if (result.ok) {
        onOpenChange(false);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <Icon className="size-3.5" />
            {meta.label}
          </div>
          <SheetTitle className="font-heading">Modifier l&apos;agent</SheetTitle>
          <SheetDescription>{meta.pitch}</SheetDescription>
        </SheetHeader>

        <div className="space-y-5 px-4 pb-4">
          <div className="space-y-2">
            <Label htmlFor={`label-${agent.id}`}>Nom affiché</Label>
            <Input
              id={`label-${agent.id}`}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={80}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`provider-${agent.id}`}>Clé provider</Label>
            <Select
              value={providerKeyId}
              onValueChange={(v) => {
                setProviderKeyId(v);
                setModelOverride("");
              }}
            >
              <SelectTrigger id={`provider-${agent.id}`}>
                <SelectValue placeholder="Hériter du chat" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_VALUE}>
                  Hériter du chat (clé choisie au moment de l&apos;envoi)
                </SelectItem>
                {providerKeys.map((k) => (
                  <SelectItem key={k.id} value={k.id}>
                    {k.label}{" "}
                    <span className="text-muted-foreground text-xs">
                      · {k.type}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Permet d&apos;assigner un provider/modèle différent par agent —
              par exemple Mistral-small pour le Relecteur, Claude pour le
              Maestro.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`model-${agent.id}`}>Modèle</Label>
            {modelOptions.length > 0 ? (
              <Select
                value={modelOverride || NONE_VALUE}
                onValueChange={(v) =>
                  setModelOverride(v === NONE_VALUE ? "" : v)
                }
              >
                <SelectTrigger id={`model-${agent.id}`}>
                  <SelectValue placeholder="Par défaut du provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>
                    Par défaut du provider
                  </SelectItem>
                  {modelOptions.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.label}{" "}
                      {m.hint && (
                        <span className="text-muted-foreground text-xs">
                          · {m.hint}
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id={`model-${agent.id}`}
                value={modelOverride}
                onChange={(e) => setModelOverride(e.target.value)}
                placeholder="ex. mistral-small-latest"
                maxLength={120}
              />
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor={`prompt-${agent.id}`}>
              System prompt{" "}
              <span className="text-muted-foreground text-xs">(optionnel)</span>
            </Label>
            <textarea
              id={`prompt-${agent.id}`}
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={6}
              placeholder={`Vide = prompt « factory » du rôle "${meta.label}".`}
              className="w-full resize-y rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 font-mono"
              maxLength={8000}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`tools-${agent.id}`}>
              Outils autorisés{" "}
              <span className="text-muted-foreground text-xs">(optionnel)</span>
            </Label>
            <Input
              id={`tools-${agent.id}`}
              value={toolAllowlistRaw}
              onChange={(e) => setToolAllowlistRaw(e.target.value)}
              placeholder="ex. legifrance_search, search_documents"
            />
            <p className="text-xs text-muted-foreground">
              Liste de noms d&apos;outils séparés par des virgules. Vide = tous
              les outils disponibles. <code>—</code> = aucun outil (l&apos;agent
              travaille uniquement sur le texte).
            </p>
          </div>

          {error && (
            <Alert variant="destructive">
              <IconAlertTriangle className="size-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <SheetFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Annuler
          </Button>
          <Button type="button" onClick={handleSave} disabled={pending}>
            {pending ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function serializeAllowlist(allowlist: string[] | null | undefined): string {
  if (allowlist === null || allowlist === undefined) return "";
  if (allowlist.length === 0) return "—";
  return allowlist.join(", ");
}

function parseAllowlist(raw: string): string[] | null | "invalid" {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  if (trimmed === "—" || trimmed === "-") return [];
  const parts = trimmed
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.some((p) => !/^[a-zA-Z0-9_]+$/.test(p))) return "invalid";
  return parts;
}
