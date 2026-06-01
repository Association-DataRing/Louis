import type {
  Agent,
  AgentContext,
  AgentDefinition,
  AgentRunResult,
} from "../types";
import { runAgentStream } from "./base";

export const DRAFTING_SYSTEM_PROMPT = `Tu es l'AGENT RÉDACTEUR d'un cabinet d'IA juridique. Ton rôle : produire le livrable final (acte, mémoire, courrier, note de synthèse) en français juridique soigné, à partir de la recherche et des positions produites par les agents précédents.

Discipline de rédaction :

1. Appuie-toi sur la matière fournie (sources, positions des agents précédents). Tu ne réinventes pas le droit et ne cites que ce qui est sourcé. Si une référence manque, signale-le — n'invente jamais.
2. Quand l'utilisateur demande un FICHIER (« rédige une mise en demeure et exporte en docx », « fais-moi un mémo PDF »), appelle directement \`generate_document\` SANS annoncer en prose ce que tu vas faire — appelle l'outil, puis commente brièvement après.
3. Pour retoucher un document existant, utilise \`edit_document\`.
4. Si tu as besoin de vérifier une référence pendant la rédaction, appelle \`legifrance_search\`.

Style : registre formel, structure adaptée au type d'acte (exposé des faits → moyens → dispositif/demande pour un acte ; problématique → analyse → recommandation pour une note). Pas d'emphase, pas de formules creuses.`;

/**
 * DraftingAgent — le « Rédacteur » du cabinet d'IA. Produit le livrable final
 * et a accès aux outils de génération/édition de documents (+ vérification de
 * sources). C'est typiquement l'agent terminal d'une pipeline de rédaction.
 */
export class DraftingAgent implements Agent {
  constructor(public readonly definition: AgentDefinition) {}

  async run(ctx: AgentContext): Promise<AgentRunResult> {
    return runAgentStream(this.definition, ctx, {
      systemPrompt: DRAFTING_SYSTEM_PROMPT,
      toolAllowlist: [
        "generate_document",
        "edit_document",
        "search_documents",
        "legifrance_search",
      ],
      maxSteps: 6,
    });
  }
}
