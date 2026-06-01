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
  label: string;
  icon: ComponentType<{ className?: string }>;
};

/**
 * Source UNIQUE de la navigation primaire — consommée par la barre latérale
 * (sidebar-content) ET la palette de commandes (command-palette). Avant, chaque
 * surface tenait sa propre copie : les renommages VOCAB (« Bureau » → « Board »,
 * etc.) devaient être appliqués à plusieurs endroits et finissaient par diverger
 * en libellé, ordre et icône. Un seul tableau ici = plus de dérive possible.
 */
export const PRIMARY_NAV: readonly NavItem[] = [
  { href: "/dashboard", label: "Tableau de bord", icon: IconLayoutDashboard },
  { href: "/chat", label: "Conversations", icon: IconMessageCircle },
  { href: "/projects", label: "Projets", icon: IconFolders },
  { href: "/documents", label: "Documents", icon: IconFolder },
  { href: "/tabular-reviews", label: "Analyses tabulaires", icon: IconTable },
  { href: "/workflows", label: "Trames", icon: IconLibrary },
  { href: "/board", label: "Board", icon: IconBriefcase },
];
