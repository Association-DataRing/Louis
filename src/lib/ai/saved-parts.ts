import type { UIMessage } from "ai";
import type { SavedPart } from "@/db/schema/messages";

/**
 * Reconstruit les parts UIMessage depuis le format minimal stocké en DB.
 * Pair les tool-call avec leur tool-result correspondant (toolCallId) pour
 * produire des parts AI SDK avec state="output-available" + input + output —
 * c'est ce que le ToolPart côté client attend pour rendre les pills.
 */
export function uiPartsFromSaved(
  saved: SavedPart[]
): UIMessage["parts"] {
  const resultByCallId = new Map<
    string,
    Extract<SavedPart, { type: "tool-result" }>
  >();
  const callIds = new Set<string>();
  for (const p of saved) {
    if (p.type === "tool-result") resultByCallId.set(p.toolCallId, p);
    else if (p.type === "tool-call") callIds.add(p.toolCallId);
  }

  const out: UIMessage["parts"] = [];
  for (const p of saved) {
    if (p.type === "text") {
      out.push({ type: "text", text: p.text } as never);
    } else if (p.type === "tool-call") {
      const result = resultByCallId.get(p.toolCallId);
      out.push({
        type: `tool-${p.toolName}`,
        toolCallId: p.toolCallId,
        state: result ? "output-available" : "input-available",
        input: p.input,
        output: result?.output,
      } as never);
    } else if (p.type === "tool-result" && !callIds.has(p.toolCallId)) {
      // tool-result ORPHELIN : pas de tool-call apparié. L'agrégation
      // multi-agents d'AI SDK v6 ne conserve souvent que l'état terminal
      // (output-available) ; sans ce cas, la part outil n'était jamais
      // réémise au reload → le rendu riche (cartes document, citations
      // Légifrance/Pappers) disparaissait. On la reconstruit avec son output.
      out.push({
        type: `tool-${p.toolName}`,
        toolCallId: p.toolCallId,
        state: "output-available",
        input: undefined,
        output: p.output,
      } as never);
    } else if (p.type === "data") {
      // Ré-émet le data part tel que les consommateurs (theatre, badges,
      // skills) l'attendent : { type: "data-agent-event", data }.
      out.push({ type: p.dataType, data: p.data } as never);
    }
    // tool-result apparié à un tool-call : déjà émis ci-dessus, on saute.
  }
  return out;
}
