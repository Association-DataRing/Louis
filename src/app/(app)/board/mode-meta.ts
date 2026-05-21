import {
  IconCircleArrowRight,
  IconUsersGroup,
  IconLayoutGrid,
  type Icon,
} from "@tabler/icons-react";

export type PipelineModeKey = "sequential" | "council" | "parallel";

/**
 * Métadonnées d'affichage centralisées pour les 3 modes d'orchestration.
 * Utilisé par la card /board, le mode selector segmented et la
 * visualisation workflow.
 */
export const MODE_META: Record<
  PipelineModeKey,
  {
    icon: Icon;
    label: string;
    short: string;
    pitch: string;
    accent: string;
  }
> = {
  sequential: {
    icon: IconCircleArrowRight,
    label: "Séquentiel",
    short: "Chaîne",
    pitch:
      "Chaque agent voit la sortie des précédents et l'enrichit. A → B → C.",
    accent: "text-foreground/70 border-border",
  },
  council: {
    icon: IconUsersGroup,
    label: "Conseil",
    short: "Débat",
    pitch:
      "N tours où chaque membre voit les positions des autres et révise la sienne.",
    accent: "text-foreground/70 border-foreground/30",
  },
  parallel: {
    icon: IconLayoutGrid,
    label: "Parallèle",
    short: "Fan-out",
    pitch:
      "Tous les agents travaillent en parallèle, le dernier synthétise.",
    accent: "text-foreground/70 border-border",
  },
};

export function modeMeta(mode: string | null | undefined) {
  return MODE_META[(mode as PipelineModeKey) ?? "sequential"] ?? MODE_META.sequential;
}
