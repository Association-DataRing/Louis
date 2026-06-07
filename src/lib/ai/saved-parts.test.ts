import { describe, it, expect } from "vitest";
import type { SavedPart } from "@/db/schema/messages";
import { uiPartsFromSaved } from "./saved-parts";

describe("uiPartsFromSaved", () => {
  it("reconstruit un tool-result ORPHELIN (sans tool-call apparié)", () => {
    // Cas réel : l'agrégation multi-agents AI SDK v6 ne conserve que l'état
    // terminal → savedParts a un tool-result mais pas de tool-call. La part
    // outil doit quand même être réémise (sinon carte document/citations
    // disparaissent au reload).
    const saved: SavedPart[] = [
      { type: "text", text: "Voici le document." },
      {
        type: "tool-result",
        toolCallId: "c1",
        toolName: "generate_document",
        output: { ok: true, data: { document_id: "d1", filename: "acte.docx" } },
      },
    ];
    const parts = uiPartsFromSaved(saved) as Array<Record<string, unknown>>;
    const tool = parts.find((p) => p.type === "tool-generate_document");
    expect(tool).toBeDefined();
    expect(tool?.state).toBe("output-available");
    expect(tool?.output).toEqual({
      ok: true,
      data: { document_id: "d1", filename: "acte.docx" },
    });
  });

  it("n'émet PAS de doublon quand tool-call ET tool-result sont présents", () => {
    const saved: SavedPart[] = [
      {
        type: "tool-call",
        toolCallId: "c1",
        toolName: "generate_document",
        input: { title: "x" },
      },
      {
        type: "tool-result",
        toolCallId: "c1",
        toolName: "generate_document",
        output: { ok: true, data: { document_id: "d1" } },
      },
    ];
    const parts = uiPartsFromSaved(saved) as Array<Record<string, unknown>>;
    const tools = parts.filter((p) => p.type === "tool-generate_document");
    expect(tools).toHaveLength(1);
    expect(tools[0].state).toBe("output-available");
    expect(tools[0].input).toEqual({ title: "x" });
    expect(tools[0].output).toEqual({ ok: true, data: { document_id: "d1" } });
  });

  it("tool-call sans résultat → input-available (pending)", () => {
    const saved: SavedPart[] = [
      {
        type: "tool-call",
        toolCallId: "c1",
        toolName: "legifrance_search",
        input: { query: "x" },
      },
    ];
    const parts = uiPartsFromSaved(saved) as Array<Record<string, unknown>>;
    expect(parts[0].state).toBe("input-available");
  });

  it("passe le texte et les data parts", () => {
    const saved: SavedPart[] = [
      { type: "text", text: "hello" },
      { type: "data", dataType: "data-agent-event", data: { foo: 1 } },
    ];
    const parts = uiPartsFromSaved(saved) as Array<Record<string, unknown>>;
    expect(parts).toEqual([
      { type: "text", text: "hello" },
      { type: "data-agent-event", data: { foo: 1 } },
    ]);
  });
});
