"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
import type { PipelineAgent, ProviderKey, AgentRagScope } from "@/db/schema";
import type {
  AgentSourceFolder,
  AgentSourceDocument,
} from "@/lib/projects/scope";
import { MODEL_CATALOG } from "@/lib/providers/models";
import type { AgentRole } from "@/lib/orchestrator";
import { roleMeta, AGENT_ROLES } from "./agent-role-meta";
import { updatePipelineAgent } from "./actions";

export interface AgentEditModelOption {
  providerType: string;
  modelId: string;
  label: string;
  hint?: string | null;
}

interface AgentEditSheetProps {
  agent: PipelineAgent;
  providerKeys: Pick<ProviderKey, "id" | "label" | "type">[];
  /** Modèles ajoutés par l'utilisateur via /settings/models/library. */
  enabledModels?: AgentEditModelOption[];
  /** Outils réellement disponibles (connecteurs actifs + RAG + MCP). */
  availableTools?: string[];
  /** Dossiers de l'utilisateur (sélecteur de portée RAG « dossiers choisis »). */
  availableFolders?: AgentSourceFolder[];
  /** Documents de l'utilisateur (sélecteur de portée RAG « documents choisis »). */
  availableDocuments?: AgentSourceDocument[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type RagMode = "inherit" | "none" | "folders" | "documents";

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
  enabledModels,
  availableTools = [],
  availableFolders = [],
  availableDocuments = [],
  open,
  onOpenChange,
}: AgentEditSheetProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [role, setRole] = useState<AgentRole>(agent.role as AgentRole);
  const [label, setLabel] = useState(agent.label);
  const [providerKeyId, setProviderKeyId] = useState<string>(
    agent.providerKeyId ?? NONE_VALUE
  );
  const [modelOverride, setModelOverride] = useState(agent.modelOverride ?? "");
  // Température : null en base = défaut du provider.
  const [tempMode, setTempMode] = useState<"default" | "custom">(
    agent.temperature == null ? "default" : "custom"
  );
  const [temperature, setTemperature] = useState<number>(
    agent.temperature ?? 0.7
  );
  const [systemPrompt, setSystemPrompt] = useState(agent.systemPrompt ?? "");
  // Allowlist : null = tous les outils, [] = aucun, [...] = sélection. Plus de
  // champ texte libre (une typo donnait un agent sans outil, silencieux).
  const [allowlistMode, setAllowlistMode] = useState<"all" | "custom">(
    agent.toolAllowlist == null ? "all" : "custom"
  );
  const [selectedTools, setSelectedTools] = useState<Set<string>>(
    new Set(agent.toolAllowlist ?? [])
  );
  // Portée documentaire RAG. null/inherit/project → « hérite » (périmètre de
  // la conversation). folders/documents → restriction par intersection.
  const [ragMode, setRagMode] = useState<RagMode>(
    agent.ragScope?.mode === "none"
      ? "none"
      : agent.ragScope?.mode === "folders"
        ? "folders"
        : agent.ragScope?.mode === "documents"
          ? "documents"
          : "inherit"
  );
  const [ragFolderIds, setRagFolderIds] = useState<Set<string>>(
    new Set(agent.ragScope?.mode === "folders" ? agent.ragScope.folderIds : [])
  );
  const [ragDocIds, setRagDocIds] = useState<Set<string>>(
    new Set(
      agent.ragScope?.mode === "documents" ? agent.ragScope.documentIds : []
    )
  );

  function toggleRagFolder(id: string) {
    setRagFolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleRagDoc(id: string) {
    setRagDocIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  // Outils de l'allowlist héritée qui ne sont plus/pas disponibles côté user.
  const unavailableSelected = Array.from(selectedTools).filter(
    (t) => !availableTools.includes(t)
  );

  function toggleTool(t: string) {
    setSelectedTools((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }

  const meta = roleMeta(role);
  const Icon = meta.icon;
  const selectedKey = providerKeys.find((k) => k.id === providerKeyId);
  // Source de vérité = modèles ajoutés via la bibliothèque. Fallback
  // sur MODEL_CATALOG curé pour ce type si rien ajouté.
  const userModels =
    selectedKey && enabledModels
      ? enabledModels.filter((m) => m.providerType === selectedKey.type)
      : [];
  const modelOptions =
    userModels.length > 0
      ? userModels.map((m) => ({
          id: m.modelId,
          label: m.label,
          hint: m.hint ?? undefined,
        }))
      : selectedKey
        ? MODEL_CATALOG[selectedKey.type]
        : [];

  function handleSave() {
    setError(null);
    const allowlist =
      allowlistMode === "all" ? null : Array.from(selectedTools);

    const ragScope: AgentRagScope | null =
      ragMode === "none"
        ? { mode: "none" }
        : ragMode === "folders"
          ? { mode: "folders", folderIds: Array.from(ragFolderIds) }
          : ragMode === "documents"
            ? { mode: "documents", documentIds: Array.from(ragDocIds) }
            : null;

    startTransition(async () => {
      const result = await updatePipelineAgent(agent.id, {
        label: label.trim() || agent.label,
        role,
        providerKeyId: providerKeyId === NONE_VALUE ? null : providerKeyId,
        modelOverride: modelOverride.trim() || null,
        temperature: tempMode === "custom" ? temperature : null,
        systemPrompt: systemPrompt.trim() ? systemPrompt : null,
        toolAllowlist: allowlist,
        ragScope,
      });
      if (result.ok) {
        onOpenChange(false);
        router.refresh();
        toast.success("Agent enregistré", {
          description: `${label.trim() || agent.label} a été mis à jour.`,
        });
      } else {
        setError(result.error);
        toast.error("Enregistrement impossible", {
          description: result.error,
        });
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
            <Label htmlFor={`role-${agent.id}`}>Rôle</Label>
            <Select value={role} onValueChange={(v) => setRole(v as AgentRole)}>
              <SelectTrigger id={`role-${agent.id}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AGENT_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {roleMeta(r).label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {role !== agent.role ? (
              <p className="flex items-start gap-1 text-xs text-warning">
                <IconAlertTriangle className="size-3.5 shrink-0 mt-px" />
                <span>
                  Changer le rôle modifie le prompt « factory » et les outils
                  par défaut de l&apos;agent. Votre prompt système personnalisé
                  est conservé.
                </span>
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">{meta.pitch}</p>
            )}
          </div>

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
            <div className="flex items-center justify-between">
              <Label htmlFor={`temp-${agent.id}`}>Température</Label>
              <div className="inline-flex rounded-md border border-border p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setTempMode("default")}
                  className={`rounded px-2.5 py-1 transition-colors ${
                    tempMode === "default"
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Défaut
                </button>
                <button
                  type="button"
                  onClick={() => setTempMode("custom")}
                  className={`rounded px-2.5 py-1 transition-colors ${
                    tempMode === "custom"
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Personnalisée
                </button>
              </div>
            </div>
            {tempMode === "custom" ? (
              <>
                <div className="flex items-center gap-3">
                  <input
                    id={`temp-${agent.id}`}
                    type="range"
                    min={0}
                    max={2}
                    step={0.1}
                    value={temperature}
                    onChange={(e) =>
                      setTemperature(parseFloat(e.target.value))
                    }
                    className="flex-1 accent-primary"
                    aria-describedby={`temp-help-${agent.id}`}
                  />
                  <span className="w-8 text-right text-sm tabular-nums">
                    {temperature.toFixed(1)}
                  </span>
                </div>
                <div
                  id={`temp-help-${agent.id}`}
                  className="flex justify-between text-[10px] text-muted-foreground"
                >
                  <span>0 · précis / factuel</span>
                  <span>créatif · 2</span>
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                Température par défaut du provider — convient à la plupart des
                usages. Passez en « Personnalisée » pour un Relecteur très
                factuel (bas) ou un Rédacteur plus créatif (haut).
              </p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor={`prompt-${agent.id}`}>
                System prompt{" "}
                <span className="text-muted-foreground text-xs">
                  (optionnel)
                </span>
              </Label>
              <span
                className={`text-xs tabular-nums ${
                  systemPrompt.length > 4000
                    ? "text-destructive"
                    : systemPrompt.length > 2000
                      ? "text-foreground"
                      : "text-muted-foreground"
                }`}
                aria-live="polite"
              >
                {systemPrompt.length} / 8000
              </span>
            </div>
            <textarea
              id={`prompt-${agent.id}`}
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={6}
              placeholder={`Vide = prompt « factory » du rôle "${meta.label}".`}
              className="w-full resize-y rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 font-mono"
              maxLength={8000}
              aria-describedby={`prompt-help-${agent.id}`}
            />
            <p
              id={`prompt-help-${agent.id}`}
              className={
                systemPrompt.length > 2000
                  ? "flex items-start gap-1 text-xs text-warning"
                  : "text-xs text-muted-foreground"
              }
            >
              {systemPrompt.length > 2000 ? (
                <>
                  <IconAlertTriangle className="size-3.5 shrink-0 mt-px" />
                  <span>
                    Ce prompt sera répété à chaque appel de cet agent — un
                    prompt long multiplie les coûts en mode council/parallel.
                  </span>
                </>
              ) : (
                "Vide = prompt « factory » du rôle. Plus le prompt est long, plus chaque appel coûte cher."
              )}
            </p>
          </div>

          <div className="space-y-2">
            <Label>
              Outils autorisés{" "}
              <span className="text-muted-foreground text-xs">(optionnel)</span>
            </Label>
            <div className="inline-flex rounded-md border border-border p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setAllowlistMode("all")}
                className={`rounded px-2.5 py-1 transition-colors ${
                  allowlistMode === "all"
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Tous les outils
              </button>
              <button
                type="button"
                onClick={() => setAllowlistMode("custom")}
                className={`rounded px-2.5 py-1 transition-colors ${
                  allowlistMode === "custom"
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Sélection
              </button>
            </div>
            {allowlistMode === "custom" && (
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                {availableTools.length === 0 &&
                unavailableSelected.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Aucun outil disponible — configurez un connecteur ou un
                    serveur MCP.
                  </p>
                ) : (
                  <>
                    {availableTools.map((t) => (
                      <label
                        key={t}
                        className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-accent"
                      >
                        <input
                          type="checkbox"
                          checked={selectedTools.has(t)}
                          onChange={() => toggleTool(t)}
                          className="size-4 accent-primary"
                        />
                        <code className="text-xs">{t}</code>
                      </label>
                    ))}
                    {unavailableSelected.map((t) => (
                      <label
                        key={t}
                        className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-accent"
                      >
                        <input
                          type="checkbox"
                          checked
                          onChange={() => toggleTool(t)}
                          className="size-4 accent-primary"
                        />
                        <code className="text-xs">{t}</code>
                        <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-warning">
                          <IconAlertTriangle className="size-3" /> indisponible
                        </span>
                      </label>
                    ))}
                  </>
                )}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {allowlistMode === "all"
                ? "L'agent peut utiliser tous les outils disponibles."
                : selectedTools.size === 0
                  ? "Aucun outil — l'agent travaille uniquement sur le texte."
                  : `${selectedTools.size} outil${
                      selectedTools.size > 1 ? "s" : ""
                    } sélectionné${selectedTools.size > 1 ? "s" : ""}.`}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`rag-${agent.id}`}>
              Sources documentaires{" "}
              <span className="text-muted-foreground text-xs">(RAG)</span>
            </Label>
            <Select
              value={ragMode}
              onValueChange={(v) => setRagMode(v as RagMode)}
            >
              <SelectTrigger id={`rag-${agent.id}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="inherit">
                  Périmètre de la conversation
                </SelectItem>
                <SelectItem value="none">Aucun document</SelectItem>
                <SelectItem value="folders">Dossiers choisis</SelectItem>
                <SelectItem value="documents">Documents choisis</SelectItem>
              </SelectContent>
            </Select>

            {ragMode === "folders" && (
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                {availableFolders.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Aucun dossier — créez-en dans l&apos;onglet Documents.
                  </p>
                ) : (
                  availableFolders.map((f) => (
                    <label
                      key={f.id}
                      className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-accent"
                      style={{ paddingLeft: 4 + f.depth * 16 }}
                    >
                      <input
                        type="checkbox"
                        checked={ragFolderIds.has(f.id)}
                        onChange={() => toggleRagFolder(f.id)}
                        className="size-4 accent-primary"
                      />
                      <span className="truncate">{f.name}</span>
                    </label>
                  ))
                )}
              </div>
            )}

            {ragMode === "documents" && (
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                {availableDocuments.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Aucun document importé.
                  </p>
                ) : (
                  availableDocuments.map((d) => (
                    <label
                      key={d.id}
                      className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-accent"
                    >
                      <input
                        type="checkbox"
                        checked={ragDocIds.has(d.id)}
                        onChange={() => toggleRagDoc(d.id)}
                        className="size-4 accent-primary shrink-0"
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {d.filename}
                      </span>
                      {!d.indexed && (
                        <span className="ml-auto inline-flex shrink-0 items-center gap-1 text-[10px] text-warning">
                          <IconAlertTriangle className="size-3" /> non indexé
                        </span>
                      )}
                    </label>
                  ))
                )}
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              {ragMode === "inherit"
                ? "L'agent lit les pièces du projet de la conversation (par défaut)."
                : ragMode === "none"
                  ? "L'agent ne lit aucune pièce — il travaille sans recherche documentaire."
                  : ragMode === "folders"
                    ? `${ragFolderIds.size} dossier${ragFolderIds.size > 1 ? "s" : ""} sélectionné${ragFolderIds.size > 1 ? "s" : ""} — intersecté avec le périmètre du projet de la conversation.`
                    : `${ragDocIds.size} document${ragDocIds.size > 1 ? "s" : ""} sélectionné${ragDocIds.size > 1 ? "s" : ""} — intersecté avec le périmètre du projet de la conversation.`}
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

