"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("board");
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
        toast.success(t("editSheet.toastSaved"), {
          description: t("editSheet.toastSavedDesc", {
            name: label.trim() || agent.label,
          }),
        });
      } else {
        setError(result.error);
        toast.error(t("editSheet.toastSaveError"), {
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
            {t(meta.labelKey)}
          </div>
          <SheetTitle className="font-heading">{t("editSheet.title")}</SheetTitle>
          <SheetDescription>{t(meta.pitchKey)}</SheetDescription>
        </SheetHeader>

        <div className="space-y-5 px-4 pb-4">
          <div className="space-y-2">
            <Label htmlFor={`role-${agent.id}`}>{t("editSheet.roleLabel")}</Label>
            <Select value={role} onValueChange={(v) => setRole(v as AgentRole)}>
              <SelectTrigger id={`role-${agent.id}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AGENT_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {t(roleMeta(r).labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {role !== agent.role ? (
              <p className="flex items-start gap-1 text-xs text-warning">
                <IconAlertTriangle className="size-3.5 shrink-0 mt-px" />
                <span>{t("editSheet.roleChangeWarning")}</span>
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">{t(meta.pitchKey)}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor={`label-${agent.id}`}>{t("editSheet.nameLabel")}</Label>
            <Input
              id={`label-${agent.id}`}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={80}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`provider-${agent.id}`}>{t("editSheet.providerLabel")}</Label>
            <Select
              value={providerKeyId}
              onValueChange={(v) => {
                setProviderKeyId(v);
                setModelOverride("");
              }}
            >
              <SelectTrigger id={`provider-${agent.id}`}>
                <SelectValue placeholder={t("editSheet.inheritPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_VALUE}>
                  {t("editSheet.inheritOption")}
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
              {t("editSheet.providerHelp")}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`model-${agent.id}`}>{t("editSheet.modelLabel")}</Label>
            {modelOptions.length > 0 ? (
              <Select
                value={modelOverride || NONE_VALUE}
                onValueChange={(v) =>
                  setModelOverride(v === NONE_VALUE ? "" : v)
                }
              >
                <SelectTrigger id={`model-${agent.id}`}>
                  <SelectValue placeholder={t("editSheet.modelDefaultPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>
                    {t("editSheet.modelDefaultOption")}
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
                placeholder={t("editSheet.modelInputPlaceholder")}
                maxLength={120}
              />
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor={`temp-${agent.id}`}>{t("editSheet.temperatureLabel")}</Label>
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
                  {t("editSheet.tempDefault")}
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
                  {t("editSheet.tempCustom")}
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
                  <span>{t("editSheet.tempLow")}</span>
                  <span>{t("editSheet.tempHigh")}</span>
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t("editSheet.tempHelp")}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor={`prompt-${agent.id}`}>
                {t("editSheet.systemPromptLabel")}{" "}
                <span className="text-muted-foreground text-xs">
                  {t("editSheet.optional")}
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
                {t("editSheet.charCount", { count: systemPrompt.length })}
              </span>
            </div>
            <textarea
              id={`prompt-${agent.id}`}
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={6}
              placeholder={t("editSheet.promptPlaceholder", { role: t(meta.labelKey) })}
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
                  <span>{t("editSheet.promptWarning")}</span>
                </>
              ) : (
                t("editSheet.promptHelp")
              )}
            </p>
          </div>

          <div className="space-y-2">
            <Label>
              {t("editSheet.toolsLabel")}{" "}
              <span className="text-muted-foreground text-xs">{t("editSheet.optional")}</span>
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
                {t("editSheet.toolsAll")}
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
                {t("editSheet.toolsCustom")}
              </button>
            </div>
            {allowlistMode === "custom" && (
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                {availableTools.length === 0 &&
                unavailableSelected.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {t("editSheet.noToolsAvailable")}
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
                    {unavailableSelected.map((tool) => (
                      <label
                        key={tool}
                        className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-accent"
                      >
                        <input
                          type="checkbox"
                          checked
                          onChange={() => toggleTool(tool)}
                          className="size-4 accent-primary"
                        />
                        <code className="text-xs">{tool}</code>
                        <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-warning">
                          <IconAlertTriangle className="size-3" /> {t("editSheet.unavailable")}
                        </span>
                      </label>
                    ))}
                  </>
                )}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {allowlistMode === "all"
                ? t("editSheet.toolsHelpAll")
                : selectedTools.size === 0
                  ? t("editSheet.toolsHelpNone")
                  : t("editSheet.toolsHelpSelected", { count: selectedTools.size })}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`rag-${agent.id}`}>
              {t("editSheet.ragLabel")}{" "}
              <span className="text-muted-foreground text-xs">{t("editSheet.ragTag")}</span>
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
                  {t("editSheet.ragInherit")}
                </SelectItem>
                <SelectItem value="none">{t("editSheet.ragNone")}</SelectItem>
                <SelectItem value="folders">{t("editSheet.ragFolders")}</SelectItem>
                <SelectItem value="documents">{t("editSheet.ragDocuments")}</SelectItem>
              </SelectContent>
            </Select>

            {ragMode === "folders" && (
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                {availableFolders.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {t("editSheet.noFolders")}
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
                    {t("editSheet.noDocuments")}
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
                          <IconAlertTriangle className="size-3" /> {t("editSheet.notIndexed")}
                        </span>
                      )}
                    </label>
                  ))
                )}
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              {ragMode === "inherit"
                ? t("editSheet.ragHelpInherit")
                : ragMode === "none"
                  ? t("editSheet.ragHelpNone")
                  : ragMode === "folders"
                    ? t("editSheet.ragHelpFolders", { count: ragFolderIds.size })
                    : t("editSheet.ragHelpDocuments", { count: ragDocIds.size })}
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
            {t("common.cancel")}
          </Button>
          <Button type="button" onClick={handleSave} disabled={pending}>
            {pending ? t("common.saving") : t("common.save")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

