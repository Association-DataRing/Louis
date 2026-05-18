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
 * l'icône / la couleur / le pitch restent cohérents partout (carte
 * /bureau, halo durant le streaming, audit trail).
 */
export const AGENT_ROLE_META: Record<
  AgentRole,
  {
    icon: Icon;
    label: string;
    pitch: string;
    accent: string;
  }
> = {
  orchestrator: {
    icon: IconBriefcase,
    label: "Maestro",
    pitch: "Coordonne et synthétise — rend la réponse finale à l'utilisateur.",
    accent: "bg-foreground/5 border-foreground/20",
  },
  research: {
    icon: IconSearch,
    label: "Recherche",
    pitch: "Cherche, source, organise les références.",
    accent: "bg-foreground/5 border-foreground/15",
  },
  citator: {
    icon: IconCheck,
    label: "Citateur",
    pitch: "Vérifie chaque référence juridique citée.",
    accent: "bg-foreground/5 border-foreground/15",
  },
  reviewer: {
    icon: IconScale,
    label: "Relecteur",
    pitch: "Déontologie, hallucinations, ton.",
    accent: "bg-foreground/5 border-foreground/15",
  },
  drafting: {
    icon: IconFileText,
    label: "Rédacteur",
    pitch: "Rédige acte, mémoire, note de synthèse.",
    accent: "bg-foreground/5 border-foreground/15",
  },
  legifrance: {
    icon: IconGavel,
    label: "Légifrance",
    pitch: "Lookup verbatim FR/EU.",
    accent: "bg-foreground/5 border-foreground/15",
  },
  "default-chat": {
    icon: IconMessageCircle,
    label: "Assistant",
    pitch: "Modèle généraliste — recherche, raisonnement, rédaction.",
    accent: "bg-foreground/5 border-foreground/15",
  },
};

export function roleMeta(role: string) {
  return AGENT_ROLE_META[role as AgentRole] ?? AGENT_ROLE_META["default-chat"];
}
