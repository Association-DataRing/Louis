import { generateObject } from "ai";
import { z } from "zod";
import type { LanguageModel } from "ai";
import type { Skill } from "@/db/schema";

const detectionSchema = z.object({
  selectedSkillSlugs: z
    .array(z.string())
    .describe(
      "Liste des slugs de compétences pertinentes pour la demande. Tableau vide si aucune ne s'applique."
    ),
});

const DETECTOR_SYSTEM = `Tu es un classificateur silencieux. Ton seul rôle est de regarder la dernière demande utilisateur et de décider quelles compétences (skills) sont pertinentes parmi celles fournies. Sois sobre — ne sélectionne une compétence QUE si elle apporte une vraie plus-value sur cette demande précise. Préfère 0 ou 1 compétences à 3 (chaque skill activée alourdit le contexte). Renvoie un JSON conforme au schéma : { "selectedSkillSlugs": ["slug-1", ...] }.`;

/**
 * Pour une demande utilisateur, retourne la liste des skills à activer
 * (par leur slug). Utilise un LLM rapide/peu coûteux pour classifier
 * et renvoie un tableau JSON typé via generateObject.
 *
 * Politique de fallback : si l'appel échoue (timeout, rate limit,
 * provider down), on retourne [] — le chat continue sans skill plutôt
 * que de bloquer toute la conversation.
 */
export async function detectRelevantSkills(args: {
  model: LanguageModel;
  userMessage: string;
  candidateSkills: Skill[];
}): Promise<string[]> {
  const { model, userMessage, candidateSkills } = args;
  if (candidateSkills.length === 0) return [];

  const enabled = candidateSkills.filter((s) => s.enabled);
  if (enabled.length === 0) return [];

  const catalog = enabled.map((s) => ({
    slug: s.slug,
    name: s.name,
    when: s.triggerHint,
  }));

  try {
    const result = await generateObject({
      model,
      schema: detectionSchema,
      system: DETECTOR_SYSTEM,
      prompt: `Compétences disponibles :
${JSON.stringify(catalog, null, 2)}

Dernière demande de l'utilisateur :
"""
${userMessage}
"""

Quelles compétences activer ?`,
      maxRetries: 1,
    });
    const valid = new Set(enabled.map((s) => s.slug));
    return result.object.selectedSkillSlugs.filter((slug) => valid.has(slug));
  } catch {
    // On avale silencieusement — le chat doit toujours répondre, même
    // sans skills auto-détectées. Le user pourra activer manuellement.
    return [];
  }
}

/**
 * Compose un bloc de system prompt à partir des skills sélectionnées.
 * Empilées dans l'ordre fourni, séparées par double newline.
 */
export function composeSkillsPrompt(skills: Skill[]): string | null {
  if (skills.length === 0) return null;
  const blocks = skills.map(
    (s) => `# Compétence : ${s.name}\n\n${s.systemPrompt}`
  );
  return blocks.join("\n\n---\n\n");
}
