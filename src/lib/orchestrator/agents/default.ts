import {
  streamText,
  stepCountIs,
  convertToModelMessages,
  type ToolSet,
} from "ai";
import { loadProviderKey, modelFromKey } from "@/lib/providers/factory";
import { buildToolsForUser } from "@/lib/connectors/tools";
import { buildMcpToolsForUser } from "@/lib/mcp/tools";
import { resolveAgentRag, omitDocumentaryRagTools } from "./rag-scope";
import {
  UNTRUSTED_CONTEXT_POLICY,
  hasUntrustedContext,
  injectUntrustedContext,
} from "../untrusted";
import { applyContextBudget } from "../context-budget";
import { applyCachedSystem } from "../provider-tuning";
import type {
  Agent,
  AgentContext,
  AgentDefinition,
  AgentRunResult,
} from "../types";

export const DEFAULT_CHAT_SYSTEM_PROMPT = `Tu es Louis, un assistant IA juridique francophone, conçu pour les professions du droit en France.

Réponds en français, avec rigueur. Lorsque tu cites une règle, indique sa source quand tu la connais (article, code, décision). Tu n'inventes JAMAIS de jurisprudence ou de référence : si tu n'es pas certain, dis-le. Tu n'es pas un avocat ; rappelle-le quand l'utilisateur semble attendre un conseil personnalisé.

UTILISATION DES TOOLS — règle essentielle :

Quand l'utilisateur demande explicitement un document (« rédige une mise en demeure et exporte en docx », « fais-moi un mémo PDF »…), tu DOIS appeler directement le tool \`generate_document\` SANS d'abord annoncer en prose ce que tu vas faire. Ne dis JAMAIS « Je vais créer le document… » avant l'appel — appelle le tool immédiatement, puis commente brièvement APRÈS que le tool a renvoyé son résultat. L'interface affiche déjà un indicateur d'activité pendant l'exécution, donc une annonce en prose est redondante et frustrante pour l'utilisateur.

Même règle pour edit_document, search_documents, legifrance_search, pappers_search : appelle d'abord, commente ensuite. Si tu as besoin de plusieurs tools en chaîne, enchaîne-les sans phrases de transition (« Je vais maintenant chercher… »).

CHOIX DE L'OUTIL — n'appelle un outil que s'il t'est EFFECTIVEMENT proposé ce tour (la liste dépend des connecteurs actifs de l'utilisateur). Si l'outil nécessaire n'est pas disponible, dis-le franchement plutôt que d'inventer un appel ou un résultat.
- Question portant sur le contenu d'un document de l'utilisateur → search_documents (recherche sémantique large) ou read_document / find_in_document (texte exact d'un document identifié) AVANT de répondre. Ne réponds pas de mémoire sur un document que tu peux lire.
- Toute règle de droit, article ou décision que tu t'apprêtes à citer → vérifie-la d'abord via legifrance_search, puis reporte la référence ET l'URL Légifrance renvoyées. Ne cite JAMAIS un article ou un arrêt de ta seule mémoire.
- Entreprise ou dirigeant français → pappers_search / pappers_get.
Après un appel d'outil, fonde ta réponse sur ce qu'il a réellement renvoyé et cite la source ; s'il ne renvoie rien d'utile, dis-le et n'invente pas.

Quand tu proposes une réécriture inline (sans génération de document complet) — clause contractuelle, paragraphe à reformuler — emballe-la dans un bloc Markdown spécial avec la langue "edit", au format suivant :

\`\`\`edit
::before
texte original mot pour mot
::after
texte proposé
::reason
(optionnel) justification courte
\`\`\`

L'interface rendra ce bloc comme une carte d'édition que l'utilisateur peut accepter ou ignorer en un clic.

Frontière : une réécriture courte proposée DANS le chat → bloc \`\`\`edit. Pour modifier un fichier .docx importé par l'utilisateur → tool edit_document (révisions Word suivies). Ne confonds pas les deux.`;

export function filterTools(
  tools: ToolSet,
  allowlist: string[] | null | undefined
): ToolSet {
  if (!allowlist || allowlist.length === 0) return tools;
  const allowed = new Set(allowlist);
  return Object.fromEntries(
    Object.entries(tools).filter(([name]) => allowed.has(name))
  ) as ToolSet;
}

/**
 * Compose le system prompt final (canal FIABLE) à partir du prompt « factory »
 * du rôle, de l'override éventuel défini par l'utilisateur, et des ajouts
 * fiables de contexte (instructions d'orchestration via systemPromptExtras).
 *
 * Le contenu NON-FIABLE (documents joints, compétences, sorties des agents
 * précédents) n'est PLUS concaténé ici : il est injecté comme message `user`
 * préfixé par injectUntrustedContext(). composeSystem se contente d'activer la
 * politique de séparation instruction/donnée quand un tel contenu est présent.
 */
export function composeSystem(
  factory: string,
  def: AgentDefinition,
  ctx: AgentContext
): string {
  const base = def.systemPrompt ?? factory;
  const parts: string[] = [base];
  if (ctx.systemPromptExtras) parts.push(ctx.systemPromptExtras);
  if (hasUntrustedContext(ctx)) parts.push(UNTRUSTED_CONTEXT_POLICY);
  return parts.join("\n\n");
}

/**
 * DefaultAgent — rôle « default-chat ». Reproduit le comportement
 * historique de /api/chat : système prompt FR, outils connecteurs + MCP,
 * stopWhen multi-step. C'est l'agent par défaut du preset chat-simple
 * et celui sur lequel retombe le pipeline mono-agent.
 */
export class DefaultAgent implements Agent {
  constructor(public readonly definition: AgentDefinition) {}

  async run(ctx: AgentContext): Promise<AgentRunResult> {
    const key = await loadProviderKey(ctx.userId, this.definition.providerKeyId);
    const model = modelFromKey(key, this.definition.modelOverride);
    const modelMessages = applyContextBudget(
      injectUntrustedContext(await convertToModelMessages(ctx.messages), ctx)
    );

    const system = composeSystem(DEFAULT_CHAT_SYSTEM_PROMPT, this.definition, ctx);

    const { scope, hideDocumentaryRag } = await resolveAgentRag(
      ctx,
      this.definition.ragScope
    );
    const [connectorTools, mcpTools] = await Promise.all([
      buildToolsForUser(ctx.userId, scope),
      buildMcpToolsForUser(ctx.userId),
    ]);
    let merged: ToolSet = { ...connectorTools, ...mcpTools };
    if (hideDocumentaryRag) merged = omitDocumentaryRagTools(merged);
    const tools = filterTools(merged, this.definition.toolAllowlist);

    const cached = applyCachedSystem({
      keyType: key.type,
      system,
      messages: modelMessages,
      hasTools: Object.keys(tools).length > 0,
    });

    const stream = streamText({
      model,
      system: cached.system,
      messages: cached.messages,
      tools,
      // Budget de pas élargi : un tour réaliste (vérifier un article + lire le
      // document joint + générer le .docx) peut chaîner 4-5 outils ; 5 ne
      // laissait aucune marge et coupait le modèle en plein milieu. Au dernier
      // pas autorisé, on retire les outils pour forcer une vraie conclusion
      // plutôt qu'un appel d'outil tronqué.
      stopWhen: stepCountIs(8),
      prepareStep: ({ stepNumber }) =>
        stepNumber >= 7 ? { toolChoice: "none" } : {},
      temperature: this.definition.temperature ?? undefined,
      abortSignal: ctx.abortSignal,
    });

    return { kind: "stream", stream };
  }
}
