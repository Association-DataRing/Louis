import type { ToolSet } from "ai";
import { buildToolsForUser, type ToolScope } from "@/lib/connectors/tools";
import { buildMcpToolsForUser } from "@/lib/mcp/tools";

/**
 * Cache de catalogue d'outils À DURÉE DE VIE D'UNE REQUÊTE.
 *
 * Problème : un run multi-agents (council = N tours × M agents, parallel =
 * fan-out) appelle `agent.run()` des dizaines de fois, et chaque appel
 * reconstruisait tout le catalogue d'outils — soit ~4 requêtes DB par agent
 * (connecteurs actifs, présence Mistral, présence de chunks, serveurs MCP).
 * Sur un council à 4 agents × 3 tours, c'est ~48 requêtes redondantes avant
 * même le premier token.
 *
 * Les outils MCP ne dépendent QUE de `userId` (constant sur toute la
 * requête) ; les outils connecteurs ne dépendent que du périmètre
 * documentaire (`ToolScope`). On mémoïse donc :
 *   - les outils MCP par userId,
 *   - les outils connecteurs par empreinte de scope.
 *
 * Sûreté : les ToolSet renvoyés ne sont JAMAIS mutés en aval (filterTools /
 * omitDocumentaryRagTools / instrumentTools renvoient tous de nouveaux
 * objets), donc le partage par référence entre agents est sans effet de bord.
 * Le cache étant lié à la requête, aucun risque de fuite cross-tenant ni de
 * péremption (un toggle de connecteur prend effet au tour suivant).
 *
 * Inspiré de la distinction catalogue(global)/sélection(par-session) de vLLM
 * Studio, ramenée ici à la granularité requête (pas de cache process-wide :
 * Louis est multi-tenant et la fraîcheur prime).
 */
export interface ToolCatalogueCache {
  connectors: Map<string, Promise<ToolSet>>;
  mcp: Map<string, Promise<ToolSet>>;
}

export function createToolCatalogueCache(): ToolCatalogueCache {
  return { connectors: new Map(), mcp: new Map() };
}

/**
 * Empreinte stable d'un périmètre documentaire. Deux agents qui partagent la
 * même empreinte obtiennent un ToolSet connecteurs fonctionnellement
 * identique → réutilisable. Les documentIds sont triés pour que l'ordre
 * n'influe pas sur l'empreinte.
 */
function scopeFingerprint(scope: ToolScope | undefined): string {
  if (!scope) return "global";
  const docs = [...scope.documentIds].sort().join(",");
  return [
    scope.projectId,
    scope.conversationId,
    scope.folderId ?? "",
    docs,
  ].join("|");
}

/**
 * Construit (ou réutilise depuis le cache de requête) les outils connecteurs
 * et MCP pour un agent. Sans cache fourni, retombe sur une construction
 * directe — utile hors orchestrateur (ex. page d'édition de board).
 */
export async function loadAgentCatalogue(
  userId: string,
  scope: ToolScope | undefined,
  cache?: ToolCatalogueCache
): Promise<{ connectorTools: ToolSet; mcpTools: ToolSet }> {
  if (!cache) {
    const [connectorTools, mcpTools] = await Promise.all([
      buildToolsForUser(userId, scope),
      buildMcpToolsForUser(userId),
    ]);
    return { connectorTools, mcpTools };
  }

  const connectorKey = `${userId}::${scopeFingerprint(scope)}`;
  let connectorPromise = cache.connectors.get(connectorKey);
  if (!connectorPromise) {
    // On mémoïse la PROMESSE (pas la valeur résolue) pour dédupliquer aussi
    // les appels concurrents d'un fan-out parallèle.
    connectorPromise = buildToolsForUser(userId, scope);
    cache.connectors.set(connectorKey, connectorPromise);
  }

  let mcpPromise = cache.mcp.get(userId);
  if (!mcpPromise) {
    mcpPromise = buildMcpToolsForUser(userId);
    cache.mcp.set(userId, mcpPromise);
  }

  const [connectorTools, mcpTools] = await Promise.all([
    connectorPromise,
    mcpPromise,
  ]);
  return { connectorTools, mcpTools };
}
