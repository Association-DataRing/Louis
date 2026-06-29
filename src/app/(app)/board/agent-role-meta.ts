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
    /** Clé i18n (namespace `board`) du libellé — résolue chez le consommateur. */
    labelKey: string;
    /** Clé i18n (namespace `board`) du pitch — résolue chez le consommateur. */
    pitchKey: string;
    /** Couleur de teinte pour le fond du node (très subtile). */
    tintBg: string;
    /** Couleur de teinte pour le header / accent (très subtile). */
    tintAccent: string;
  }
> = {
  orchestrator: {
    icon: IconBriefcase,
    labelKey: "meta.roles.orchestrator.label",
    pitchKey: "meta.roles.orchestrator.pitch",
    tintBg: "bg-[oklch(0.99_0.005_265)] dark:bg-[oklch(0.18_0.018_265)]",
    tintAccent:
      "bg-[oklch(0.95_0.012_265)] dark:bg-[oklch(0.22_0.025_265)]",
  },
  research: {
    icon: IconSearch,
    labelKey: "meta.roles.research.label",
    pitchKey: "meta.roles.research.pitch",
    tintBg: "bg-[oklch(0.985_0.008_230)] dark:bg-[oklch(0.18_0.018_230)]",
    tintAccent:
      "bg-[oklch(0.95_0.018_230)] dark:bg-[oklch(0.22_0.028_230)]",
  },
  citator: {
    icon: IconCheck,
    labelKey: "meta.roles.citator.label",
    pitchKey: "meta.roles.citator.pitch",
    tintBg: "bg-[oklch(0.985_0.008_160)] dark:bg-[oklch(0.18_0.018_160)]",
    tintAccent:
      "bg-[oklch(0.95_0.02_160)] dark:bg-[oklch(0.22_0.03_160)]",
  },
  reviewer: {
    icon: IconScale,
    labelKey: "meta.roles.reviewer.label",
    pitchKey: "meta.roles.reviewer.pitch",
    tintBg: "bg-[oklch(0.985_0.008_85)] dark:bg-[oklch(0.18_0.018_85)]",
    tintAccent:
      "bg-[oklch(0.95_0.02_85)] dark:bg-[oklch(0.22_0.03_85)]",
  },
  drafting: {
    icon: IconFileText,
    labelKey: "meta.roles.drafting.label",
    pitchKey: "meta.roles.drafting.pitch",
    tintBg: "bg-[oklch(0.985_0.008_310)] dark:bg-[oklch(0.18_0.018_310)]",
    tintAccent:
      "bg-[oklch(0.95_0.02_310)] dark:bg-[oklch(0.22_0.03_310)]",
  },
  legifrance: {
    icon: IconGavel,
    labelKey: "meta.roles.legifrance.label",
    pitchKey: "meta.roles.legifrance.pitch",
    tintBg: "bg-[oklch(0.985_0.008_265)] dark:bg-[oklch(0.18_0.018_265)]",
    tintAccent:
      "bg-[oklch(0.95_0.02_265)] dark:bg-[oklch(0.22_0.03_265)]",
  },
  "default-chat": {
    icon: IconMessageCircle,
    labelKey: "meta.roles.default-chat.label",
    pitchKey: "meta.roles.default-chat.pitch",
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
