"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { IconPlus, IconSparkles } from "@tabler/icons-react";
import { PERSONAS, type Persona } from "../personas";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import type { ProviderKey } from "@/db/schema";
import { MODEL_CATALOG } from "@/lib/providers/models";
import { roleMeta } from "../agent-role-meta";
import { addAgentToPipeline } from "../actions";

interface AddAgentDialogProps {
  pipelineId: string;
  providerKeys: Pick<ProviderKey, "id" | "label" | "type">[];
  /** Modèles ajoutés par l'utilisateur via /settings/models/library. */
  enabledModels?: Array<{
    providerType: string;
    modelId: string;
    label: string;
    hint?: string | null;
  }>;
}

type Role =
  | "default-chat"
  | "orchestrator"
  | "research"
  | "drafting"
  | "reviewer"
  | "citator"
  | "legifrance";

const ROLE_OPTIONS: Role[] = [
  "default-chat",
  "research",
  "legifrance",
  "citator",
  "reviewer",
  "drafting",
  "orchestrator",
];

const NONE_VALUE = "__none__";

/**
 * Dialog d'ajout d'agent à une pipeline existante. Choisit le rôle (qui
 * détermine quel système prompt « factory » s'applique), un label
 * humain, la clé provider et le modèle. Le system prompt + l'allowlist
 * d'outils restent éditables après création via le drawer node.
 */
export function AddAgentDialog({
  pipelineId,
  providerKeys,
  enabledModels,
}: AddAgentDialogProps) {
  const router = useRouter();
  const t = useTranslations("board");
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [role, setRole] = useState<Role>("default-chat");
  const [label, setLabel] = useState("");
  const [providerKeyId, setProviderKeyId] = useState<string>(NONE_VALUE);
  const [modelOverride, setModelOverride] = useState("");
  const [systemPromptFromPersona, setSystemPromptFromPersona] = useState<
    string | null
  >(null);
  const [pickedPersona, setPickedPersona] = useState<string | null>(null);

  function applyPersona(p: Persona) {
    setRole(p.role);
    setLabel(t(p.labelKey));
    setSystemPromptFromPersona(p.systemPrompt);
    setPickedPersona(p.slug);
  }

  const selectedKey = providerKeys.find((k) => k.id === providerKeyId);
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
  const roleM = roleMeta(role);

  function reset() {
    setRole("default-chat");
    setLabel("");
    setProviderKeyId(NONE_VALUE);
    setModelOverride("");
    setSystemPromptFromPersona(null);
    setPickedPersona(null);
    setError(null);
  }

  function handleAdd() {
    setError(null);
    if (!label.trim()) {
      setError(t("addAgent.nameRequired"));
      return;
    }
    startTransition(async () => {
      const result = await addAgentToPipeline(pipelineId, {
        role,
        label: label.trim(),
        providerKeyId: providerKeyId === NONE_VALUE ? null : providerKeyId,
        modelOverride: modelOverride.trim() || null,
        systemPrompt: systemPromptFromPersona,
        toolAllowlist: null,
      });
      if (result.ok) {
        setOpen(false);
        reset();
        router.refresh();
        toast.success(t("addAgent.added"), {
          description: t("addAgent.addedDesc", { name: label.trim() }),
        });
      } else {
        setError(result.error);
        toast.error(t("addAgent.addError"), {
          description: result.error,
        });
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="default"
          className="shadow-sm pl-3 pr-4 h-10"
        >
          <IconPlus className="size-4" />
          {t("addAgent.heading")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">
            {t("addAgent.heading")}
          </DialogTitle>
          <DialogDescription>
            {t("addAgent.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Persona quick-pick — démarre avec un agent pré-configuré */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <IconSparkles className="size-3.5 text-foreground/60" />
              <Label className="text-xs text-foreground/70 uppercase tracking-wider">
                {t("addAgent.personaLabel")}
              </Label>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {PERSONAS.map((p) => (
                <button
                  key={p.slug}
                  type="button"
                  onClick={() => applyPersona(p)}
                  title={t(p.pitchKey)}
                  className={`group flex flex-col items-center gap-0.5 rounded-lg border px-1.5 py-2 text-[10px] transition-all ${
                    pickedPersona === p.slug
                      ? "border-foreground/40 bg-foreground/5"
                      : "border-border bg-card hover:border-foreground/20 hover:bg-card/70"
                  }`}
                >
                  <span className="text-base leading-none">{p.emoji}</span>
                  <span className="font-medium text-foreground line-clamp-1 leading-tight">
                    {t(p.labelKey)}
                  </span>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {t("addAgent.manualHint")}
            </p>
          </div>

          <div className="border-t border-border pt-4 space-y-4">

          <div className="space-y-2">
            <Label htmlFor="agent-role">{t("addAgent.roleLabel")}</Label>
            <Select value={role} onValueChange={(v) => setRole(v as Role)}>
              <SelectTrigger id="agent-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((r) => {
                  const m = roleMeta(r);
                  const Icon = m.icon;
                  return (
                    <SelectItem key={r} value={r}>
                      <Icon className="size-3.5" />
                      {t(m.labelKey)}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{t(roleM.pitchKey)}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="agent-label">{t("addAgent.nameLabel")}</Label>
            <Input
              id="agent-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={t("addAgent.namePlaceholder")}
              maxLength={80}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="agent-provider">{t("addAgent.providerLabel")}</Label>
            <Select
              value={providerKeyId}
              onValueChange={(v) => {
                setProviderKeyId(v);
                setModelOverride("");
              }}
            >
              <SelectTrigger id="agent-provider">
                <SelectValue placeholder={t("addAgent.inheritPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_VALUE}>
                  {t("addAgent.inheritOption")}
                </SelectItem>
                {providerKeys.map((k) => (
                  <SelectItem key={k.id} value={k.id}>
                    {k.label}{" "}
                    <span className="text-xs text-muted-foreground">
                      · {k.type}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {modelOptions.length === 0 && (
            <p className="text-[11px] text-muted-foreground">
              {t("addAgent.noKeyHint")}
            </p>
          )}

          {modelOptions.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="agent-model">{t("addAgent.modelLabel")}</Label>
              <Select
                value={modelOverride || NONE_VALUE}
                onValueChange={(v) =>
                  setModelOverride(v === NONE_VALUE ? "" : v)
                }
              >
                <SelectTrigger id="agent-model">
                  <SelectValue placeholder={t("addAgent.modelDefaultPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>
                    {t("addAgent.modelDefaultOption")}
                  </SelectItem>
                  {modelOptions.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.label}
                      {m.hint && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          · {m.hint}
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            {t("common.cancel")}
          </Button>
          <Button type="button" onClick={handleAdd} disabled={pending}>
            {pending ? t("addAgent.adding") : t("addAgent.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
