import { streamText, stepCountIs, convertToModelMessages, type ToolSet } from "ai";
import { loadProviderKey, modelFromKey } from "@/lib/providers/factory";
import { buildToolsForUser } from "@/lib/connectors/tools";
import { buildMcpToolsForUser } from "@/lib/mcp/tools";
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

Quand tu proposes une réécriture inline (sans génération de document complet) — clause contractuelle, paragraphe à reformuler — emballe-la dans un bloc Markdown spécial avec la langue "edit", au format suivant :

\`\`\`edit
::before
texte original mot pour mot
::after
texte proposé
::reason
(optionnel) justification courte
\`\`\`

L'interface rendra ce bloc comme une carte d'édition que l'utilisateur peut accepter ou ignorer en un clic.`;

function filterTools(tools: ToolSet, allowlist: string[] | null | undefined): ToolSet {
  if (!allowlist || allowlist.length === 0) return tools;
  const allowed = new Set(allowlist);
  return Object.fromEntries(
    Object.entries(tools).filter(([name]) => allowed.has(name))
  ) as ToolSet;
}

/**
 * DefaultAgent — v0.1 single-agent pipeline. Reproduces the historical
 * `/api/chat` behaviour (BYOK provider, full tool set, FR legal system
 * prompt), wrapped in the Agent interface so the route can route through
 * an Orchestrator without behavioural change.
 *
 * In v0.2 this agent becomes one role among many (default-chat) and the
 * Orchestrator can compose it with research / drafting / reviewer agents.
 */
export class DefaultAgent implements Agent {
  constructor(public readonly definition: AgentDefinition) {}

  async run(ctx: AgentContext): Promise<AgentRunResult> {
    const key = await loadProviderKey(ctx.userId, this.definition.providerKeyId);
    const model = modelFromKey(key, this.definition.modelOverride);
    const modelMessages = await convertToModelMessages(ctx.messages);

    const baseSystem = this.definition.systemPrompt ?? DEFAULT_CHAT_SYSTEM_PROMPT;
    const system = ctx.systemPromptExtras
      ? `${baseSystem}\n\n${ctx.systemPromptExtras}`
      : baseSystem;

    const [connectorTools, mcpTools] = await Promise.all([
      buildToolsForUser(ctx.userId),
      buildMcpToolsForUser(ctx.userId),
    ]);
    const tools = filterTools(
      { ...connectorTools, ...mcpTools },
      this.definition.toolAllowlist
    );

    const stream = streamText({
      model,
      system,
      messages: modelMessages,
      tools,
      stopWhen: stepCountIs(5),
      onFinish: ctx.onFinish,
    });

    return { stream };
  }
}
