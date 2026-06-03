import type { ModelMessage } from "ai";
import type { ProviderKey } from "@/db/schema";

/**
 * Sous ce seuil (en caractères), Anthropic ignore le cacheControl (le bloc est
 * trop court pour être mis en cache) — on ne pose donc pas de breakpoint inutile.
 */
const MIN_CACHE_CHARS = 1024;

/**
 * Active le prompt caching Anthropic sur le préfixe STABLE outils + système.
 *
 * Les agents juridiques de Louis embarquent un long prompt système et un gros
 * schéma d'outils IDENTIQUES à chaque tour et à chaque round de council (le
 * synthétiseur est ré-appelé avec le même préfixe). En déplaçant le système
 * dans un message `system` porteur d'un breakpoint de cache éphémère, Anthropic
 * met ce préfixe en cache (~90 % de coût input en moins dessus + latence
 * réduite) — ce qui allège directement le quota par cabinet (quota.ts).
 *
 * Pour les autres providers (ou un préfixe trop court), renvoie le système
 * inchangé sous forme de param string.
 */
export function applyCachedSystem(opts: {
  keyType: ProviderKey["type"];
  system: string;
  messages: ModelMessage[];
  hasTools: boolean;
}): { system?: string; messages: ModelMessage[] } {
  const { keyType, system, messages, hasTools } = opts;
  const worthCaching = hasTools || system.length >= MIN_CACHE_CHARS;
  if (keyType !== "anthropic" || !worthCaching) {
    return { system, messages };
  }
  const systemMessage: ModelMessage = {
    role: "system",
    content: system,
    providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } },
  };
  return { system: undefined, messages: [systemMessage, ...messages] };
}
