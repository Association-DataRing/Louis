import {
  IconCircleArrowRight,
  IconUsersGroup,
  IconLayoutGrid,
  IconRefresh,
  IconWand,
  type Icon,
} from "@tabler/icons-react";

export type PipelineModeKey =
  | "sequential"
  | "council"
  | "parallel"
  | "iterative"
  | "maestro";

/**
 * Métadonnées d'affichage centralisées pour les 3 modes d'orchestration.
 * Utilisé par la card /board, le mode selector segmented et la
 * visualisation workflow.
 */
export const MODE_META: Record<
  PipelineModeKey,
  {
    icon: Icon;
    /** Clé i18n (namespace `board`) du libellé — résolue chez le consommateur. */
    labelKey: string;
    /** Clé i18n (namespace `board`) du libellé court — résolue chez le consommateur. */
    shortKey: string;
    /** Clé i18n (namespace `board`) du pitch — résolue chez le consommateur. */
    pitchKey: string;
    accent: string;
  }
> = {
  sequential: {
    icon: IconCircleArrowRight,
    labelKey: "meta.modes.sequential.label",
    shortKey: "meta.modes.sequential.short",
    pitchKey: "meta.modes.sequential.pitch",
    accent: "text-foreground/70 border-border",
  },
  council: {
    icon: IconUsersGroup,
    labelKey: "meta.modes.council.label",
    shortKey: "meta.modes.council.short",
    pitchKey: "meta.modes.council.pitch",
    accent: "text-foreground/70 border-foreground/30",
  },
  parallel: {
    icon: IconLayoutGrid,
    labelKey: "meta.modes.parallel.label",
    shortKey: "meta.modes.parallel.short",
    pitchKey: "meta.modes.parallel.pitch",
    accent: "text-foreground/70 border-border",
  },
  iterative: {
    icon: IconRefresh,
    labelKey: "meta.modes.iterative.label",
    shortKey: "meta.modes.iterative.short",
    pitchKey: "meta.modes.iterative.pitch",
    accent: "text-foreground/70 border-border",
  },
  maestro: {
    icon: IconWand,
    labelKey: "meta.modes.maestro.label",
    shortKey: "meta.modes.maestro.short",
    pitchKey: "meta.modes.maestro.pitch",
    accent: "text-foreground/70 border-primary/40",
  },
};

export function modeMeta(mode: string | null | undefined) {
  return MODE_META[(mode as PipelineModeKey) ?? "sequential"] ?? MODE_META.sequential;
}
