"use client";

import Link from "next/link";
import {
  IconPlus,
  IconPaperclip,
  IconSparkles,
  IconBriefcase,
  IconSettings,
  IconWorld,
  IconFileText,
  IconKey,
  IconCpu,
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
  /** Ouvre le picker de documents joints. */
  onPickDocument: () => void;
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
  onPickDocument,
  onPickWorkflow,
  workflows,
  pipelines,
  currentPipelineId,
  onPipelineChange,
  onPickWorkflowItem,
}: ComposerMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        className="inline-flex items-center justify-center size-10 rounded-md hover:bg-accent transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        aria-label="Insérer ou configurer"
        title="Insérer ou configurer"
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
          Insérer
        </DropdownMenuLabel>

        <DropdownMenuItem onSelect={onPickDocument}>
          <IconPaperclip className="size-4" />
          Joindre un document
        </DropdownMenuItem>

        {workflows.length > 0 ? (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <IconSparkles className="size-4" />
              Workflow
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
                Voir tous les workflows
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        ) : (
          <DropdownMenuItem onSelect={onPickWorkflow}>
            <IconSparkles className="size-4" />
            Workflow
          </DropdownMenuItem>
        )}

        {pipelines.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              Board
            </DropdownMenuLabel>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <IconBriefcase className="size-4" />
                Pipeline
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
                      {p.agentCount} agent{p.agentCount > 1 ? "s" : ""}
                    </span>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/bureau">
                    <IconBriefcase className="size-4" />
                    Gérer le board
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
          Réglages
        </DropdownMenuLabel>

        <DropdownMenuItem asChild>
          <Link href="/settings/providers">
            <IconKey className="size-4" />
            Clés providers
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings/models">
            <IconCpu className="size-4" />
            Modèles
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/workflows">
            <IconFileText className="size-4" />
            Tous les workflows
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings/general">
            <IconSettings className="size-4" />
            Tous les réglages
          </Link>
        </DropdownMenuItem>

        {/* Slot futur : web search toggle, style picker… */}
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled className="opacity-50">
          <IconWorld className="size-4" />
          Recherche web
          <span className="ml-auto text-[10px] text-muted-foreground">
            bientôt
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
