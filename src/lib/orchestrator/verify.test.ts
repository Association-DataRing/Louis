import { describe, it, expect } from "vitest";
import type { SavedPart } from "@/db/schema";
import { effectfulOutcomes, assessDeliverable } from "./verify";

const toolResult = (toolName: string, output: unknown): SavedPart => ({
  type: "tool-result",
  toolCallId: "x",
  toolName,
  output,
});

describe("effectfulOutcomes / assessDeliverable", () => {
  it("ignore les tours sans outil effectif", () => {
    const parts: SavedPart[] = [
      { type: "text", text: "réponse" },
      toolResult("legifrance_search", { ok: true, data: [] }),
    ];
    const a = assessDeliverable(parts);
    expect(a.hadEffectful).toBe(false);
    expect(a.allOk).toBe(true);
  });

  it("détecte un livrable RÉUSSI", () => {
    const parts: SavedPart[] = [
      toolResult("generate_document", { ok: true, data: { id: "doc1" } }),
    ];
    const a = assessDeliverable(parts);
    expect(a.hadEffectful).toBe(true);
    expect(a.allOk).toBe(true);
    expect(a.failures).toEqual([]);
  });

  it("détecte le mensonge : génération annoncée mais ok:false", () => {
    const parts: SavedPart[] = [
      { type: "text", text: "J'ai créé la mise en demeure." },
      toolResult("generate_document", {
        ok: false,
        reason: "server",
        error: "gotenberg indisponible",
      }),
    ];
    const a = assessDeliverable(parts);
    expect(a.hadEffectful).toBe(true);
    expect(a.allOk).toBe(false);
    expect(a.failures).toEqual([
      { tool: "generate_document", error: "gotenberg indisponible" },
    ]);
  });

  it("traite une sortie malformée comme un échec (prudence)", () => {
    const parts: SavedPart[] = [toolResult("edit_document", null)];
    const a = assessDeliverable(parts);
    expect(a.allOk).toBe(false);
    expect(a.failures[0].tool).toBe("edit_document");
  });

  it("décode l'enveloppe AI SDK {type:json,value} (régression: faux deliverable.failed)", () => {
    // L'output peut arriver enveloppé par l'AI SDK v6. La lecture brute de
    // `o.ok` retournait undefined → ok:false sur un livrable pourtant réussi.
    const parts: SavedPart[] = [
      toolResult("generate_document", {
        type: "json",
        value: { ok: true, data: { document_id: "doc1" } },
      }),
    ];
    const a = assessDeliverable(parts);
    expect(a.hadEffectful).toBe(true);
    expect(a.allOk).toBe(true);
    expect(a.failures).toEqual([]);
  });

  it("décode aussi un échec enveloppé {type:json,value:{ok:false}}", () => {
    const parts: SavedPart[] = [
      toolResult("edit_document", {
        type: "json",
        value: { ok: false, error: "ancre introuvable" },
      }),
    ];
    const a = assessDeliverable(parts);
    expect(a.allOk).toBe(false);
    expect(a.failures).toEqual([
      { tool: "edit_document", error: "ancre introuvable" },
    ]);
  });

  it("agrège plusieurs outils effectifs", () => {
    const parts: SavedPart[] = [
      toolResult("generate_document", { ok: true, data: {} }),
      toolResult("edit_document", { ok: false, error: "ancre introuvable" }),
    ];
    const outcomes = effectfulOutcomes(parts);
    expect(outcomes).toHaveLength(2);
    expect(assessDeliverable(parts).allOk).toBe(false);
  });
});
