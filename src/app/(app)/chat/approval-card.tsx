"use client";

import { useState } from "react";
import { IconCheck, IconShieldQuestion, IconX } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { toolMeta } from "./tool-meta";

export type ApprovalRequestData = {
  approvalId: string;
  toolName: string;
  input?: unknown;
};

/**
 * Carte d'approbation human-in-the-loop : émise en cours de run quand un
 * outil sensible (édition de document, outil MCP) attend le feu vert de
 * l'utilisateur. La réponse part vers /api/chat/approval qui débloque
 * l'exécution suspendue côté serveur ; le résultat de l'outil arrive ensuite
 * dans le même stream (pill d'outil classique).
 *
 * `isLive` : la carte n'est actionnable que pendant le streaming du message —
 * après coup (timeout, refus, reload), elle n'est qu'un constat.
 */
export function ApprovalCard({
  data,
  isLive,
}: {
  data: ApprovalRequestData;
  isLive: boolean;
}) {
  const [state, setState] = useState<
    "pending" | "sending" | "approved" | "denied"
  >("pending");
  const meta = toolMeta(data.toolName);
  const inputPreview =
    data.input && typeof data.input === "object"
      ? JSON.stringify(data.input, null, 2)
      : null;

  async function respond(approved: boolean) {
    setState("sending");
    try {
      await fetch("/api/chat/approval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvalId: data.approvalId, approved }),
      });
      setState(approved ? "approved" : "denied");
    } catch {
      setState("pending");
    }
  }

  const resolved = state === "approved" || state === "denied";
  const actionable = isLive && !resolved;

  return (
    <div
      className={cn(
        "my-2 rounded-xl border px-4 py-3 text-sm motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-300",
        resolved || !isLive
          ? "border-border bg-muted/30"
          : "border-warning/40 bg-warning/5"
      )}
    >
      <div className="flex items-start gap-2.5">
        <IconShieldQuestion
          className={cn(
            "mt-0.5 size-4 shrink-0",
            actionable ? "text-warning" : "text-muted-foreground"
          )}
        />
        <div className="min-w-0 flex-1">
          <p className="font-medium">
            {state === "approved"
              ? "Action approuvée"
              : state === "denied"
                ? "Action refusée"
                : "Louis demande votre accord"}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Outil sensible :{" "}
            <span className="font-medium text-foreground/80">{meta.chip}</span>{" "}
            <code className="rounded bg-muted px-1 py-px text-[11px]">
              {data.toolName}
            </code>
            {state === "pending" && !isLive && " — demande expirée ou résolue."}
          </p>
          {inputPreview && (
            <details className="mt-1.5">
              <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                Voir le détail de l&apos;action
              </summary>
              <pre className="mt-1 max-h-40 overflow-auto rounded-md bg-muted/60 p-2 text-[11px] leading-relaxed">
                {inputPreview}
              </pre>
            </details>
          )}
          {actionable && (
            <div className="mt-2.5 flex items-center gap-2">
              <button
                type="button"
                disabled={state === "sending"}
                onClick={() => respond(true)}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                <IconCheck className="size-3.5" />
                Approuver
              </button>
              <button
                type="button"
                disabled={state === "sending"}
                onClick={() => respond(false)}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-50"
              >
                <IconX className="size-3.5" />
                Refuser
              </button>
              <span className="text-[11px] text-muted-foreground">
                Sans réponse sous 5 min, l&apos;action est refusée.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
