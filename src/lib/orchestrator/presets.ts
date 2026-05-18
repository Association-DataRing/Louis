import type { AgentRole } from "./types";

/**
 * Template d'agent au sein d'un preset — sans providerKeyId ni
 * modelOverride, qui sont attachés à l'utilisateur au moment du clonage
 * (seedPresetsForUser).
 */
export interface PresetAgentTemplate {
  role: AgentRole;
  label: string;
  /** null = tous les outils ; [] = aucun ; [...] = sous-ensemble. */
  toolAllowlist?: string[] | null;
}

export interface PresetTemplate {
  slug: string;
  name: string;
  description: string;
  agents: PresetAgentTemplate[];
}

/**
 * Catalogue des pipelines préfabriqués livrés avec Louis. Au premier login
 * (et au passage d'une nouvelle version qui en ajoute), `seedPresetsForUser`
 * crée une copie modifiable pour l'utilisateur — qui peut ensuite la cloner,
 * la renommer ou la supprimer depuis /bureau.
 */
export const PIPELINE_PRESETS: PresetTemplate[] = [
  {
    slug: "chat-simple",
    name: "Chat simple",
    description:
      "Pipeline mono-agent. Un seul modèle gère recherche, raisonnement et rédaction. Idéal pour le quotidien et pour démarrer.",
    agents: [
      {
        role: "default-chat",
        label: "Assistant Louis",
        toolAllowlist: null,
      },
    ],
  },
  {
    slug: "recherche-juridique",
    name: "Recherche juridique sourcée",
    description:
      "Pipeline 3 agents — Recherche (Légifrance + RAG + Pappers) → Citateur (vérification verbatim) → Maestro (synthèse finale streamée). Pour les questions où la qualité des sources prime.",
    agents: [
      {
        role: "research",
        label: "Recherche",
        toolAllowlist: [
          "legifrance_search",
          "pappers_search",
          "pappers_get",
          "search_documents",
        ],
      },
      {
        role: "citator",
        label: "Citateur",
        toolAllowlist: ["legifrance_search"],
      },
      {
        role: "orchestrator",
        label: "Maestro",
        toolAllowlist: null,
      },
    ],
  },
  {
    slug: "redaction-actes",
    name: "Rédaction d'actes avec relecture",
    description:
      "Pipeline 4 agents — Recherche → Rédaction → Relecteur (déontologie + hallucinations) → Maestro (livrable final + génération DOCX). Pour produire un acte sourcé et relu.",
    agents: [
      {
        role: "research",
        label: "Recherche",
        toolAllowlist: [
          "legifrance_search",
          "pappers_search",
          "pappers_get",
          "search_documents",
        ],
      },
      {
        role: "default-chat",
        label: "Rédacteur",
        toolAllowlist: ["legifrance_search", "search_documents"],
      },
      {
        role: "reviewer",
        label: "Relecteur",
        toolAllowlist: [],
      },
      {
        role: "orchestrator",
        label: "Maestro",
        toolAllowlist: null,
      },
    ],
  },
];

export function findPreset(slug: string): PresetTemplate | undefined {
  return PIPELINE_PRESETS.find((p) => p.slug === slug);
}
