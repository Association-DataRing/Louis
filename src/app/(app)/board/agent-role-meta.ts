import {
  IconBriefcase,
  IconCheck,
  IconFileText,
  IconGavel,
  IconMessageCircle,
  IconScale,
  IconSearch,
  type Icon,
} from "@tabler/icons-react";
import type { AgentRole } from "@/lib/orchestrator";

/**
 * Métadonnées d'affichage par rôle d'agent. Centralisé ici pour que
 * l'icône / la teinte / le pitch restent cohérents partout (carte
 * /board, halo durant le streaming, audit trail).
 *
 * `tint` est une teinte LÉGÈRE (5% chroma) ajoutée au fond du node pour
 * différencier visuellement les rôles sans tomber dans le rainbow AI.
 * Valeurs choisies dans le hue 265 (cohérent avec la marque) ± variation.
 */
export const AGENT_ROLE_META: Record<
  AgentRole,
  {
    icon: Icon;
    label: string;
    pitch: string;
    /** Couleur de teinte pour le fond du node (très subtile). */
    tintBg: string;
    /** Couleur de teinte pour le header / accent (très subtile). */
    tintAccent: string;
  }
> = {
  orchestrator: {
    icon: IconBriefcase,
    label: "Maestro",
    pitch: "Coordonne et synthétise — rend la réponse finale à l'utilisateur.",
    tintBg: "bg-[oklch(0.99_0.005_265)] dark:bg-[oklch(0.18_0.018_265)]",
    tintAccent:
      "bg-[oklch(0.95_0.012_265)] dark:bg-[oklch(0.22_0.025_265)]",
  },
  research: {
    icon: IconSearch,
    label: "Recherche",
    pitch: "Cherche, source, organise les références.",
    tintBg: "bg-[oklch(0.985_0.008_230)] dark:bg-[oklch(0.18_0.018_230)]",
    tintAccent:
      "bg-[oklch(0.95_0.018_230)] dark:bg-[oklch(0.22_0.028_230)]",
  },
  citator: {
    icon: IconCheck,
    label: "Citateur",
    pitch: "Vérifie chaque référence juridique citée.",
    tintBg: "bg-[oklch(0.985_0.008_160)] dark:bg-[oklch(0.18_0.018_160)]",
    tintAccent:
      "bg-[oklch(0.95_0.02_160)] dark:bg-[oklch(0.22_0.03_160)]",
  },
  reviewer: {
    icon: IconScale,
    label: "Relecteur",
    pitch: "Déontologie, hallucinations, ton.",
    tintBg: "bg-[oklch(0.985_0.008_85)] dark:bg-[oklch(0.18_0.018_85)]",
    tintAccent:
      "bg-[oklch(0.95_0.02_85)] dark:bg-[oklch(0.22_0.03_85)]",
  },
  drafting: {
    icon: IconFileText,
    label: "Rédacteur",
    pitch: "Rédige acte, mémoire, note de synthèse.",
    tintBg: "bg-[oklch(0.985_0.008_310)] dark:bg-[oklch(0.18_0.018_310)]",
    tintAccent:
      "bg-[oklch(0.95_0.02_310)] dark:bg-[oklch(0.22_0.03_310)]",
  },
  legifrance: {
    icon: IconGavel,
    label: "Légifrance",
    pitch: "Lookup verbatim FR/EU.",
    tintBg: "bg-[oklch(0.985_0.008_265)] dark:bg-[oklch(0.18_0.018_265)]",
    tintAccent:
      "bg-[oklch(0.95_0.02_265)] dark:bg-[oklch(0.22_0.03_265)]",
  },
  "default-chat": {
    icon: IconMessageCircle,
    label: "Assistant",
    pitch: "Modèle généraliste — recherche, raisonnement, rédaction.",
    tintBg: "bg-card",
    tintAccent: "bg-muted/30",
  },
};

export function roleMeta(role: string) {
  return AGENT_ROLE_META[role as AgentRole] ?? AGENT_ROLE_META["default-chat"];
}

/** Rôles sélectionnables (ordre du plus généraliste au plus terminal). */
export const AGENT_ROLES: AgentRole[] = [
  "default-chat",
  "research",
  "legifrance",
  "citator",
  "drafting",
  "reviewer",
  "orchestrator",
];
