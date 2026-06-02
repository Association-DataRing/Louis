import type { ToolSet } from "ai";
import type { ToolScope } from "@/lib/connectors/tools";
import { getDocsInFolders } from "@/lib/projects/scope";
import type { AgentContext, AgentRagScope } from "../types";

/** Intersection : ne garde de `chosen` que ce qui est déjà dans `allowed`. */
export function intersectDocIds(chosen: string[], allowed: string[]): string[] {
  const allowedSet = new Set(allowed);
  return chosen.filter((id) => allowedSet.has(id));
}

/**
 * Outils qui LISENT les documents RAG de l'utilisateur (vs outils de création
 * `generate_document`/`edit_document` ou connecteurs externes). Le mode
 * `none` d'un agent masque exactement ceux-là.
 */
export const DOCUMENTARY_RAG_TOOLS = [
  "search_documents",
  "list_documents",
  "read_document",
  "find_in_document",
] as const;

/** Retire les outils de lecture documentaire d'un toolset (mode `none`). */
export function omitDocumentaryRagTools(tools: ToolSet): ToolSet {
  const drop = new Set<string>(DOCUMENTARY_RAG_TOOLS);
  return Object.fromEntries(
    Object.entries(tools).filter(([name]) => !drop.has(name))
  ) as ToolSet;
}

/** Périmètre documentaire de la conversation (base de toute restriction). */
function conversationScope(ctx: AgentContext): ToolScope | undefined {
  return ctx.projectId
    ? {
        projectId: ctx.projectId,
        conversationId: ctx.conversationId,
        documentIds: ctx.projectDocumentIds ?? [],
        folderId: ctx.projectFolderId ?? null,
      }
    : undefined;
}

/**
 * Résout la portée documentaire RAG d'UN agent à partir de sa `ragScope` et du
 * périmètre de la conversation. Renvoie le `ToolScope` à passer à
 * `buildToolsForUser` (donc on ne touche ni cette fonction ni `search.ts`) et
 * un drapeau `hideDocumentaryRag` pour le cas `none` en conversation globale.
 *
 * Invariant de sécurité : la portée d'un agent est TOUJOURS une intersection
 * avec le périmètre de la conversation — jamais une extension. Le dossier de
 * destination des documents générés reste celui du projet.
 *
 * Lot 1a : `inherit`/`project`/`none` (purs, 0 requête). `folders`/`documents`
 * sont câblés en Lot 1b (intersection via requêtes).
 */
export async function resolveAgentRag(
  ctx: AgentContext,
  ragScope: AgentRagScope | null | undefined
): Promise<{ scope: ToolScope | undefined; hideDocumentaryRag: boolean }> {
  const base = conversationScope(ctx);

  if (!ragScope || ragScope.mode === "inherit" || ragScope.mode === "project") {
    return { scope: base, hideDocumentaryRag: false };
  }

  if (ragScope.mode === "none") {
    // En mode projet, documentIds=[] suffit (search_documents non proposé) ;
    // on masque aussi les outils documentaires pour couvrir la conversation
    // globale (sans projet, donc sans scope à vider).
    return {
      scope: base ? { ...base, documentIds: [] } : undefined,
      hideDocumentaryRag: true,
    };
  }

  // folders / documents : restriction PAR INTERSECTION avec le périmètre
  // projet. Hors conversation projet (base absent), on ne peut pas intersecter
  // un périmètre curé → repli sûr sur le comportement global (jamais au-delà
  // des documents de l'utilisateur, garanti par le filtre userId de search.ts).
  if (!base) return { scope: undefined, hideDocumentaryRag: false };

  if (ragScope.mode === "documents") {
    return {
      scope: {
        ...base,
        documentIds: intersectDocIds(ragScope.documentIds, base.documentIds),
      },
      hideDocumentaryRag: false,
    };
  }

  // folders : on résout les documents des sous-arbres choisis, puis intersection.
  const inFolders = await getDocsInFolders(ctx.userId, ragScope.folderIds);
  return {
    scope: {
      ...base,
      documentIds: intersectDocIds(inFolders, base.documentIds),
    },
    hideDocumentaryRag: false,
  };
}
