import { nanoid } from "nanoid";
import type { ToolSet } from "ai";

/**
 * Garde-fous human-in-the-loop : certains outils sensibles (modification de
 * document, outils MCP tiers) ne s'exécutent qu'après approbation explicite
 * de l'utilisateur, EN COURS de run.
 *
 * Mécanique « in-stream » : l'`execute` de l'outil est suspendu sur une
 * promesse ; le run émet un part `data-approval-request` que le chat rend
 * comme carte Approuver/Refuser ; la réponse arrive par POST
 * /api/chat/approval qui résout la promesse. Le stream reste ouvert — pas de
 * round-trip de resoumission, pas d'état d'approbation à persister.
 *
 * Limite assumée : le registre est en mémoire processus — valide pour le
 * déploiement Louis (une instance par cabinet). En multi-instance, il
 * faudrait le déplacer dans Redis.
 */

type PendingApproval = {
  userId: string;
  resolve: (approved: boolean) => void;
};

declare global {
  var __louisApprovals: Map<string, PendingApproval> | undefined;
}

function registry(): Map<string, PendingApproval> {
  if (!globalThis.__louisApprovals) {
    globalThis.__louisApprovals = new Map();
  }
  return globalThis.__louisApprovals;
}

/** Délai au-delà duquel une demande sans réponse vaut refus. */
export const APPROVAL_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Enregistre une demande d'approbation et rend une promesse résolue par la
 * réponse utilisateur (ou refusée d'office au timeout / à l'annulation du
 * run). `approvalId` doit avoir été émis dans le stream au préalable.
 */
export function registerApproval(opts: {
  approvalId: string;
  userId: string;
  abortSignal?: AbortSignal;
  timeoutMs?: number;
}): Promise<boolean> {
  const { approvalId, userId, abortSignal } = opts;
  const timeoutMs = opts.timeoutMs ?? APPROVAL_TIMEOUT_MS;

  return new Promise<boolean>((resolve) => {
    const finish = (approved: boolean) => {
      registry().delete(approvalId);
      clearTimeout(timer);
      abortSignal?.removeEventListener("abort", onAbort);
      resolve(approved);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    const onAbort = () => finish(false);
    abortSignal?.addEventListener("abort", onAbort, { once: true });
    registry().set(approvalId, { userId, resolve: finish });
  });
}

/**
 * Résout une demande en attente. Renvoie false si la demande est inconnue
 * (déjà résolue, timeout, autre instance) ou n'appartient pas à
 * l'utilisateur — on ne distingue pas les deux cas pour ne pas divulguer
 * l'existence d'approbations d'autrui.
 */
export function resolveApproval(
  userId: string,
  approvalId: string,
  approved: boolean
): boolean {
  const pending = registry().get(approvalId);
  if (!pending || pending.userId !== userId) return false;
  pending.resolve(approved);
  return true;
}

export function newApprovalId(): string {
  return nanoid();
}

/**
 * Outils soumis à approbation. Configurable par l'admin via
 * LOUIS_APPROVAL_TOOLS (noms séparés par des virgules ; `mcp` couvre tous
 * les outils MCP). Défaut : modification de documents existants + tous les
 * outils MCP (serveurs tiers = effets de bord hors de l'instance).
 */
export function approvalGatedToolNames(): { names: Set<string>; allMcp: boolean } {
  const raw = process.env.LOUIS_APPROVAL_TOOLS;
  if (raw === "") return { names: new Set(), allMcp: false }; // désactivé
  if (!raw) return { names: new Set(["edit_document"]), allMcp: true };
  const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
  return {
    names: new Set(parts.filter((p) => p !== "mcp")),
    allMcp: parts.includes("mcp"),
  };
}

export function isApprovalGated(toolName: string): boolean {
  const { names, allMcp } = approvalGatedToolNames();
  if (names.has(toolName)) return true;
  return allMcp && toolName.startsWith("mcp__");
}

/**
 * Demande d'approbation côté run : fournie par la route (qui détient le
 * writer du stream) et propagée aux agents via AgentContext.
 */
export type RequestToolApproval = (
  toolName: string,
  input: unknown
) => Promise<boolean>;

/**
 * Enveloppe les outils sensibles d'un garde d'approbation. Sans
 * `requestApproval` (tests, contextes hors stream), les outils passent
 * inchangés — le garde est un dispositif d'UI, pas un contrôle d'accès.
 */
export function withApprovalGates(
  tools: ToolSet,
  requestApproval: RequestToolApproval | undefined
): ToolSet {
  if (!requestApproval) return tools;
  const gated: ToolSet = {};
  for (const [name, t] of Object.entries(tools)) {
    if (!isApprovalGated(name) || !t.execute) {
      gated[name] = t;
      continue;
    }
    const original = t.execute.bind(t);
    gated[name] = {
      ...t,
      execute: async (input, options) => {
        const approved = await requestApproval(name, input);
        if (!approved) {
          // Enveloppe ToolResult uniforme (cf. lib/ai/tool-result.ts) : le
          // modèle reçoit un refus explicite et peut poursuivre proprement.
          return {
            ok: false,
            error:
              "Action refusée par l'utilisateur (ou demande expirée). Ne réessaie pas cette action ; propose une alternative ou demande des précisions.",
          };
        }
        return original(input, options);
      },
    };
  }
  return gated;
}
