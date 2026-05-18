import type { PipelineConfig } from "./types";

/**
 * Pipeline « chat-simple » — mono-agent reproduisant le comportement
 * historique de /api/chat. C'est le fallback v0.1 et le preset par défaut
 * quand aucune pipeline n'est sélectionnée par l'utilisateur.
 */
export function chatSimplePipeline(args: {
  providerKeyId: string;
  modelOverride?: string | null;
}): PipelineConfig {
  return {
    slug: "chat-simple",
    name: "Chat simple",
    description:
      "Pipeline mono-agent : un seul modèle gère recherche, rédaction et raisonnement.",
    agents: [
      {
        id: "default-chat",
        role: "default-chat",
        label: "Assistant Louis",
        providerKeyId: args.providerKeyId,
        modelOverride: args.modelOverride ?? null,
      },
    ],
  };
}
