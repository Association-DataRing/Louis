import type { PipelineConfig } from "./types";

/**
 * Default "chat-simple" pipeline — a single agent with the user's chosen
 * provider key and model. Reproduces the historical /api/chat behaviour
 * for full backward compatibility.
 */
export function chatSimplePipeline(args: {
  providerKeyId: string;
  modelOverride?: string | null;
}): PipelineConfig {
  return {
    name: "chat-simple",
    description:
      "Pipeline mono-agent : un seul modèle gère recherche, rédaction et raisonnement.",
    primary: {
      id: "default-chat",
      role: "default-chat",
      providerKeyId: args.providerKeyId,
      modelOverride: args.modelOverride ?? null,
    },
  };
}
