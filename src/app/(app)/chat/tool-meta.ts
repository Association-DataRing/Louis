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
  type Icon,
} from "@tabler/icons-react";

export type ToolCategory = "document" | "recherche" | "lecture" | "mcp";

export interface ToolMeta {
  icon: Icon;
  /** Étiquette courte à droite de la ligne (comme « script » / « file »). */
  chip: string;
  category: ToolCategory;
  /** Outil produisant un livrable → ligne dépliée par défaut. */
  primary: boolean;
}

const META: Record<string, ToolMeta> = {
  generate_document: { icon: IconFileText, chip: "document", category: "document", primary: true },
  edit_document: { icon: IconEditCircle, chip: "édition", category: "document", primary: true },
  search_documents: { icon: IconSearch, chip: "recherche", category: "recherche", primary: false },
  find_in_document: { icon: IconSearch, chip: "lecture", category: "lecture", primary: false },
  read_document: { icon: IconBook2, chip: "lecture", category: "lecture", primary: false },
  list_documents: { icon: IconList, chip: "lecture", category: "lecture", primary: false },
  legifrance_search: { icon: IconScale, chip: "Légifrance", category: "recherche", primary: false },
  pappers_search: { icon: IconBuilding, chip: "Pappers", category: "recherche", primary: false },
  pappers_get: { icon: IconBuilding, chip: "Pappers", category: "recherche", primary: false },
  search_conversation_history: { icon: IconHistory, chip: "historique", category: "recherche", primary: false },
};

export function toolMeta(name: string): ToolMeta {
  return META[name] ?? { icon: IconTool, chip: "MCP", category: "mcp", primary: false };
}

/** Résumé façon « N outils · X documents · Y recherches » à partir des noms. */
export function summarizeTools(names: string[]): string {
  const cat = (n: string) => toolMeta(n).category;
  const docs = names.filter((n) => cat(n) === "document").length;
  const searches = names.filter((n) => cat(n) === "recherche").length;
  const reads = names.filter((n) => cat(n) === "lecture").length;
  const parts: string[] = [`${names.length} outil${names.length > 1 ? "s" : ""}`];
  if (docs > 0) parts.push(`${docs} document${docs > 1 ? "s" : ""}`);
  if (searches > 0) parts.push(`${searches} recherche${searches > 1 ? "s" : ""}`);
  if (reads > 0) parts.push(`${reads} lecture${reads > 1 ? "s" : ""}`);
  return parts.join(" · ");
}
