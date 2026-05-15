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
  for (const p of saved) {
    if (p.type === "tool-result") {
      resultByCallId.set(p.toolCallId, p);
    }
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
    }
    // tool-result : déjà pairé avec son tool-call ci-dessus, on saute.
  }
  return out;
}
