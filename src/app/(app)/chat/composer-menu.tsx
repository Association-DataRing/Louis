"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  IconPlus,
  IconSparkles,
  IconBriefcase,
  IconSettings,
  IconFileText,
  IconKey,
  IconCpu,
  IconPlugConnected,
  IconBolt,
} from "@tabler/icons-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

interface ComposerMenuProps {
  disabled?: boolean;
  /** Ouvre le picker de workflow (prompt insertion). */
  onPickWorkflow: () => void;
  /** Listing rapide des workflows utilisateur pour les exposer en sub-menu. */
  workflows: Array<{ id: string; name: string; prompt: string }>;
  /** Listing rapide des pipelines pour switch direct. */
  pipelines: Array<{ id: string; name: string; agentCount: number }>;
  /** Pipeline active courante (highlight dans la sub). */
  currentPipelineId: string | null;
  /** Bascule de pipeline (utilise la même API que le pill sélecteur). */
  onPipelineChange: (id: string) => void;
  /** Workflow → injecte le prompt dans le composer. */
  onPickWorkflowItem: (prompt: string) => void;
}

/**
 * Menu unifié "+" en début de composer — inspiré du menu d'actions de
 * Claude. Regroupe joindre un document, insérer un workflow, basculer
 * de pipeline, et accès rapide aux réglages clés (providers, modèles).
 *
 * Le bouton remplace les ex-icônes paperclip + sparkles dispersées et
 * apporte une hiérarchie claire (Insérer, Configurer, Réglages).
 */
export function ComposerMenu({
  disabled,
  onPickWorkflow,
  workflows,
  pipelines,
  currentPipelineId,
  onPipelineChange,
  onPickWorkflowItem,
}: ComposerMenuProps) {
  const t = useTranslations("chat");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        className="inline-flex items-center justify-center size-10 rounded-md hover:bg-accent transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
        aria-label={t("composerMenu.trigger")}
        title={t("composerMenu.trigger")}
      >
        <IconPlus className="size-4" />
      </DropdownMenuTrigger>

      <DropdownMenuContent
        side="top"
        align="start"
        sideOffset={8}
        className="w-64"
      >
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
          {t("composerMenu.insert")}
        </DropdownMenuLabel>

        {workflows.length > 0 ? (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <IconSparkles className="size-4" />
              {t("composerMenu.templates")}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-72">
              {workflows.slice(0, 12).map((w) => (
                <DropdownMenuItem
                  key={w.id}
                  onSelect={() => onPickWorkflowItem(w.prompt)}
                  className="flex-col items-start gap-0.5"
                >
                  <span className="text-sm">{w.name}</span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onPickWorkflow}>
                <IconSparkles className="size-4" />
                {t("composerMenu.allTemplates")}
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        ) : (
          <DropdownMenuItem onSelect={onPickWorkflow}>
            <IconSparkles className="size-4" />
            {t("composerMenu.templates")}
          </DropdownMenuItem>
        )}

        {pipelines.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              {t("composerMenu.board")}
            </DropdownMenuLabel>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <IconBriefcase className="size-4" />
                {t("composerMenu.pipeline")}
                <span className="ml-auto text-[10px] text-muted-foreground truncate max-w-[120px]">
                  {pipelines.find((p) => p.id === currentPipelineId)?.name ??
                    "—"}
                </span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-72">
                {pipelines.map((p) => (
                  <DropdownMenuItem
                    key={p.id}
                    onSelect={() => onPipelineChange(p.id)}
                    className={
                      p.id === currentPipelineId
                        ? "bg-accent/60 font-medium"
                        : ""
                    }
                  >
                    <IconBriefcase className="size-3.5 text-muted-foreground" />
                    <span className="truncate">{p.name}</span>
                    <span className="ml-auto text-[10px] text-muted-foreground">
                      {t("composerMenu.agents", { count: p.agentCount })}
                    </span>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/board">
                    <IconBriefcase className="size-4" />
                    {t("composerMenu.manageBoard")}
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
          {t("composerMenu.settings")}
        </DropdownMenuLabel>

        <DropdownMenuItem asChild>
          <Link href="/settings/providers">
            <IconKey className="size-4" />
            {t("composerMenu.providerKeys")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings/models">
            <IconCpu className="size-4" />
            {t("composerMenu.models")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings/skills">
            <IconSparkles className="size-4" />
            {t("composerMenu.skills")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings/connectors">
            <IconPlugConnected className="size-4" />
            {t("composerMenu.connectors")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings/mcp">
            <IconBolt className="size-4" />
            {t("composerMenu.mcpServers")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/workflows">
            <IconFileText className="size-4" />
            {t("composerMenu.allWorkflows")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings/general">
            <IconSettings className="size-4" />
            {t("composerMenu.allSettings")}
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
