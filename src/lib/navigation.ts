import type { ComponentType } from "react";
import {
  IconLayoutDashboard,
  IconMessageCircle,
  IconFolders,
  IconFolder,
  IconTable,
  IconLibrary,
  IconBriefcase,
} from "@tabler/icons-react";

export type NavItem = {
  href: string;
  /** Clé i18n dans le namespace `nav` (résolue chez le consommateur). */
  labelKey: string;
  icon: ComponentType<{ className?: string }>;
};

/**
 * Source UNIQUE de la navigation primaire — consommée par la barre latérale
 * (sidebar-content) ET la palette de commandes (command-palette). Avant, chaque
 * surface tenait sa propre copie : les renommages VOCAB (« Bureau » → « Board »,
 * etc.) devaient être appliqués à plusieurs endroits et finissaient par diverger
 * en libellé, ordre et icône. Un seul tableau ici = plus de dérive possible.
 *
 * Les libellés sont des clés i18n (namespace `nav`) résolues côté consommateur
 * via `useTranslations("nav")` / `getTranslations("nav")` — ce module n'est pas
 * un composant React, il ne peut donc pas appeler le hook lui-même.
 */
export const PRIMARY_NAV: readonly NavItem[] = [
  { href: "/dashboard", labelKey: "dashboard", icon: IconLayoutDashboard },
  { href: "/chat", labelKey: "chat", icon: IconMessageCircle },
  { href: "/projects", labelKey: "projects", icon: IconFolders },
  { href: "/documents", labelKey: "documents", icon: IconFolder },
  { href: "/tabular-reviews", labelKey: "tabularReviews", icon: IconTable },
  { href: "/workflows", labelKey: "workflows", icon: IconLibrary },
  { href: "/board", labelKey: "board", icon: IconBriefcase },
];
