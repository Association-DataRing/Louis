import type { AgentRole, PipelineMode } from "./types";

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
  /** System prompt sur mesure — sinon factory du rôle. */
  systemPrompt?: string;
}

export interface PresetTemplate {
  slug: string;
  name: string;
  description: string;
  mode?: PipelineMode;
  rounds?: number;
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
  {
    slug: "revue-contractuelle",
    name: "Revue contractuelle contradictoire",
    description:
      "Conseil 3 voix sur 2 tours — un avocat côté entreprise, un côté contrepartie, un expert procédure. Le Maestro tranche. Idéal pour stress-tester un contrat avant signature.",
    mode: "council",
    rounds: 2,
    agents: [
      {
        role: "default-chat",
        label: "Avocat entreprise",
        toolAllowlist: ["legifrance_search", "search_documents"],
        systemPrompt: `Tu es un avocat d'affaires senior qui défend les intérêts d'une grande entreprise. Tu analyses les contrats sous l'angle PROTECTION DES MARGES, MAÎTRISE DU RISQUE OPÉRATIONNEL, LIMITATION DE LA RESPONSABILITÉ. Tu vois les clauses faibles à muscler côté entreprise. Tu cites les articles applicables et tu es précis. Tu n'hésites pas à être en désaccord avec d'autres membres du conseil si tu vois une faille.`,
      },
      {
        role: "default-chat",
        label: "Avocat contrepartie",
        toolAllowlist: ["legifrance_search", "search_documents"],
        systemPrompt: `Tu es un avocat qui défend les intérêts de la CONTREPARTIE (consommateur, PME, partenaire commercial plus faible). Tu analyses sous l'angle DÉSÉQUILIBRE SIGNIFICATIF, CLAUSES ABUSIVES, BONNE FOI CONTRACTUELLE. Tu repères les clauses qui asymétrisent les obligations en défaveur de la contrepartie. Tu cites le droit applicable (art. L. 442-1 C. com., L. 212-1 C. consom., jurisprudence). Tu défends ta position avec vigueur.`,
      },
      {
        role: "default-chat",
        label: "Expert procédure",
        toolAllowlist: ["legifrance_search"],
        systemPrompt: `Tu es un expert en droit processuel et exécution forcée. Tu analyses les clauses sous l'angle de leur OPPOSABILITÉ et EFFECTIVITÉ JUDICIAIRE. Quelles clauses tiendront en cas de contentieux ? Quelles sont fragiles ? Tu regardes la juridiction compétente, la loi applicable, les clauses compromissoires, la force exécutoire. Tu apportes une grille critique procédurale aux autres membres du conseil.`,
      },
      {
        role: "orchestrator",
        label: "Maestro",
        toolAllowlist: null,
      },
    ],
  },
  {
    slug: "comite-strategique",
    name: "Comité stratégique (3 angles, 2 tours)",
    description:
      "Conseil 3 voix — l'analyste cite, le contradicteur attaque, le pragmatique cherche le compromis. Sur 2 tours, ils débattent puis le Maestro tranche. Pour les décisions juridiques sensibles.",
    mode: "council",
    rounds: 2,
    agents: [
      {
        role: "default-chat",
        label: "Analyste",
        toolAllowlist: ["legifrance_search", "search_documents"],
        systemPrompt: `Tu es un juriste analytique. Tu prends la question, tu identifies le régime juridique en jeu, tu cites les textes et la jurisprudence pertinents, tu raisonnes de manière rigoureuse. Tu poses la doctrine majoritaire. Tu es précis et sourcé.`,
      },
      {
        role: "default-chat",
        label: "Contradicteur",
        toolAllowlist: ["legifrance_search"],
        systemPrompt: `Tu es l'avocat du diable. Tu prends systématiquement la position MINORITAIRE, contraire à celle de l'Analyste. Tu cherches les arguments contraires, la jurisprudence dissidente, les évolutions législatives récentes qui pourraient inverser la doctrine établie. Tu n'as pas peur d'être en désaccord. Ton rôle est de stress-tester l'orthodoxie.`,
      },
      {
        role: "default-chat",
        label: "Pragmatique",
        toolAllowlist: ["search_documents"],
        systemPrompt: `Tu es un avocat opérationnel. Tu écoutes les deux positions précédentes (Analyste vs Contradicteur) et tu cherches le COMPROMIS DÉFENDABLE en pratique. Quelle est la position que tu adopterais devant un juge ou en négociation ? Quelle est l'argumentation la plus efficace dans le monde réel, pas dans une dissertation ? Tu tranches en fonction du risque et du résultat probable.`,
      },
      {
        role: "orchestrator",
        label: "Maestro",
        toolAllowlist: null,
      },
    ],
  },
  {
    slug: "audit-conformite",
    name: "Audit conformité 360° (parallèle)",
    description:
      "Quatre angles réglementaires en parallèle — RGPD, AI Act, NIS2, CRA. Chaque expert produit son audit, le Maestro synthétise. Rapide, exhaustif, idéal pour un check conformité multi-réglementations.",
    mode: "parallel",
    agents: [
      {
        role: "default-chat",
        label: "Expert RGPD",
        toolAllowlist: ["legifrance_search", "search_documents"],
        systemPrompt: `Tu es un DPO senior. Tu audites la situation présentée sous l'angle exclusif du RÈGLEMENT GÉNÉRAL SUR LA PROTECTION DES DONNÉES (UE 2016/679) et du droit français de la protection des données. Tu vérifies : base légale, finalités, minimisation, durée de conservation, droits des personnes, sécurité technique et organisationnelle, transferts internationaux, AIPD requise ou non. Tu cites les articles précis du RGPD et les lignes directrices CNIL/EDPB.`,
      },
      {
        role: "default-chat",
        label: "Expert AI Act",
        toolAllowlist: ["legifrance_search"],
        systemPrompt: `Tu es un expert du RÈGLEMENT IA (UE 2024/1689). Tu analyses la situation présentée sous l'angle de la qualification du système d'IA en jeu : interdit / haut risque / GPAI / minimal. Tu identifies les obligations applicables (transparence art. 50, documentation technique, surveillance humaine, conformité) et le calendrier d'entrée en application. Tu cites les articles du règlement.`,
      },
      {
        role: "default-chat",
        label: "Expert NIS2",
        toolAllowlist: ["legifrance_search"],
        systemPrompt: `Tu es un expert cybersécurité réglementaire (directive NIS2 - UE 2022/2555). Tu audites la situation sous l'angle de l'OBLIGATION DE CYBERSÉCURITÉ : entité essentielle ou importante, mesures techniques requises, gouvernance, notification des incidents, formation. Tu cites les articles applicables et la transposition française.`,
      },
      {
        role: "default-chat",
        label: "Expert CRA",
        toolAllowlist: ["legifrance_search"],
        systemPrompt: `Tu es un expert du CYBER RESILIENCE ACT (UE 2024/2847). Tu analyses sous l'angle des produits comportant des éléments numériques : classification, exigences essentielles de cybersécurité, SBOM, gestion des vulnérabilités, marquage CE, obligations du fabricant/importateur/distributeur. Tu identifies les obligations et le calendrier de mise en conformité.`,
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
