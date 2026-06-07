import type { SavedPart } from "@/db/schema";
import { toolResultOk } from "@/lib/ai/tool-result";

/**
 * Outils EFFECTIFS : ceux qui produisent un livrable (document) plutôt que de
 * seulement lire/chercher. C'est sur eux que porte la vérification.
 */
export const EFFECTFUL_TOOLS = new Set(["generate_document", "edit_document"]);

export type EffectfulOutcome = { tool: string; ok: boolean; error?: string };

/**
 * Extrait, des parts persistées d'un tour, le résultat réel des outils
 * effectifs (succès/échec via l'enveloppe ToolResult { ok }). C'est la source
 * de vérité : si generate_document a renvoyé ok:false alors que le modèle a
 * affirmé « j'ai créé la mise en demeure », le livrable n'existe pas.
 */
export function effectfulOutcomes(parts: SavedPart[]): EffectfulOutcome[] {
  const out: EffectfulOutcome[] = [];
  for (const p of parts) {
    if (p.type !== "tool-result" || !EFFECTFUL_TOOLS.has(p.toolName)) continue;
    // toolResultOk décode l'enveloppe AI SDK ({type:"json",value:{ok,...}})
    // avant de lire `ok` — sinon un livrable réussi mais enveloppé était lu
    // comme ok:false (faux « deliverable.failed »).
    const { ok, error } = toolResultOk(p.output);
    out.push({ tool: p.toolName, ok, error });
  }
  return out;
}

export type DeliverableAssessment = {
  /** Au moins un outil effectif a été utilisé ce tour. */
  hadEffectful: boolean;
  /** Tous les outils effectifs ont réussi. */
  allOk: boolean;
  failures: { tool: string; error?: string }[];
};

/**
 * Évalue un tour : un outil effectif a-t-il été utilisé, et a-t-il réellement
 * abouti ? Déterministe (pas d'appel LLM), donc plus fiable qu'un vérificateur
 * probabiliste pour le mode d'échec central (le tool a silencieusement échoué).
 */
export function assessDeliverable(parts: SavedPart[]): DeliverableAssessment {
  const outcomes = effectfulOutcomes(parts);
  const failures = outcomes
    .filter((o) => !o.ok)
    .map((o) => ({ tool: o.tool, error: o.error }));
  return {
    hadEffectful: outcomes.length > 0,
    allOk: failures.length === 0,
    failures,
  };
}
