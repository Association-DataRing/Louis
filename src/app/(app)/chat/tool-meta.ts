import {
  IconFileText,
  IconEditCircle,
  IconSearch,
  IconBook2,
  IconList,
  IconScale,
  IconBuilding,
  IconHistory,
  IconTool,
  IconGavel,
  IconReceipt,
  IconBookmark,
  type Icon,
} from "@tabler/icons-react";

export type ToolCategory = "document" | "recherche" | "lecture" | "mcp";

export interface ToolMeta {
  icon: Icon;
  /**
   * Clé i18n (sous `chat.toolMeta.chips`) de l'étiquette courte affichée à
   * droite de la ligne — résolue chez le consommateur. Les noms de marque
   * (Légifrance, Pappers…) restent identiques en FR/EN.
   */
  chipKey: string;
  category: ToolCategory;
  /** Outil produisant un livrable → ligne dépliée par défaut. */
  primary: boolean;
}

const META: Record<string, ToolMeta> = {
  generate_document: { icon: IconFileText, chipKey: "document", category: "document", primary: true },
  edit_document: { icon: IconEditCircle, chipKey: "edit", category: "document", primary: true },
  search_documents: { icon: IconSearch, chipKey: "search", category: "recherche", primary: false },
  find_in_document: { icon: IconSearch, chipKey: "read", category: "lecture", primary: false },
  read_document: { icon: IconBook2, chipKey: "read", category: "lecture", primary: false },
  list_documents: { icon: IconList, chipKey: "read", category: "lecture", primary: false },
  legifrance_search: { icon: IconScale, chipKey: "legifrance", category: "recherche", primary: false },
  judilibre_search: { icon: IconGavel, chipKey: "judilibre", category: "recherche", primary: false },
  judilibre_decision: { icon: IconGavel, chipKey: "judilibre", category: "recherche", primary: false },
  bofip_search: { icon: IconBookmark, chipKey: "bofip", category: "recherche", primary: false },
  bodacc_search: { icon: IconReceipt, chipKey: "bodacc", category: "recherche", primary: false },
  pappers_search: { icon: IconBuilding, chipKey: "pappers", category: "recherche", primary: false },
  pappers_get: { icon: IconBuilding, chipKey: "pappers", category: "recherche", primary: false },
  search_conversation_history: { icon: IconHistory, chipKey: "history", category: "recherche", primary: false },
};

export function toolMeta(name: string): ToolMeta {
  return META[name] ?? { icon: IconTool, chipKey: "mcp", category: "mcp", primary: false };
}

/**
 * Résumé façon « N outils · X documents · Y recherches » à partir des noms.
 * Prend le translator (`useTranslations("chat")`) car ce module n'est pas un
 * composant React et ne peut pas appeler de hook.
 */
export function summarizeTools(
  names: string[],
  t: (key: string, values?: Record<string, number>) => string
): string {
  const cat = (n: string) => toolMeta(n).category;
  const docs = names.filter((n) => cat(n) === "document").length;
  const searches = names.filter((n) => cat(n) === "recherche").length;
  const reads = names.filter((n) => cat(n) === "lecture").length;
  const parts: string[] = [t("toolMeta.summary.tools", { count: names.length })];
  if (docs > 0) parts.push(t("toolMeta.summary.documents", { count: docs }));
  if (searches > 0) parts.push(t("toolMeta.summary.searches", { count: searches }));
  if (reads > 0) parts.push(t("toolMeta.summary.reads", { count: reads }));
  return parts.join(" · ");
}
