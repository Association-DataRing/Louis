import { describe, it, expect } from "vitest";
import {
  unwrapToolResult,
  toolResultOk,
  documentArtifactFromToolResult,
} from "./tool-result";

const DOC = { document_id: "doc1", filename: "acte.docx", format: "docx" };

describe("unwrapToolResult", () => {
  it("dépile l'enveloppe AI SDK json + ToolResult", () => {
    expect(
      unwrapToolResult({ type: "json", value: { ok: true, data: DOC } })
    ).toEqual(DOC);
  });
  it("dépile une enveloppe ToolResult brute", () => {
    expect(unwrapToolResult({ ok: true, data: DOC })).toEqual(DOC);
  });
  it("parse une string JSON", () => {
    expect(unwrapToolResult(JSON.stringify({ ok: true, data: DOC }))).toEqual(
      DOC
    );
  });
  it("retourne null sur ok:false", () => {
    expect(unwrapToolResult({ ok: false, error: "x" })).toBeNull();
  });
  it("retourne l'objet déjà dépouillé (sans enveloppe ok/data)", () => {
    expect(unwrapToolResult(DOC)).toEqual(DOC);
  });
  it("retourne null sur null / primitive", () => {
    expect(unwrapToolResult(null)).toBeNull();
    expect(unwrapToolResult(42)).toBeNull();
  });
});

describe("toolResultOk (préserve ok:false)", () => {
  it("lit ok sur enveloppe json", () => {
    expect(toolResultOk({ type: "json", value: { ok: true, data: DOC } })).toEqual(
      { ok: true, error: undefined }
    );
  });
  it("lit l'échec + error", () => {
    expect(
      toolResultOk({ type: "json", value: { ok: false, error: "boom" } })
    ).toEqual({ ok: false, error: "boom" });
  });
  it("ok:false par défaut sur sortie malformée", () => {
    expect(toolResultOk(null)).toEqual({ ok: false, error: undefined });
    expect(toolResultOk("pas du json")).toEqual({ ok: false, error: undefined });
  });
});

describe("documentArtifactFromToolResult", () => {
  it("extrait l'artefact d'un generate_document (enveloppe json)", () => {
    expect(
      documentArtifactFromToolResult("generate_document", {
        type: "json",
        value: { ok: true, data: DOC },
      })
    ).toEqual({
      documentId: "doc1",
      filename: "acte.docx",
      format: "docx",
      kind: "generated",
    });
  });
  it("extrait l'artefact d'un edit_document (enveloppe brute)", () => {
    expect(
      documentArtifactFromToolResult("edit_document", {
        ok: true,
        data: { document_id: "d2", filename: "v2.docx", format: "docx" },
      })
    ).toEqual({
      documentId: "d2",
      filename: "v2.docx",
      format: "docx",
      kind: "edited",
    });
  });
  it("normalise un format inconnu vers docx", () => {
    expect(
      documentArtifactFromToolResult("generate_document", {
        ok: true,
        data: { document_id: "d3", filename: "x", format: undefined },
      })?.format
    ).toBe("docx");
  });
  it("retourne null sur ok:false", () => {
    expect(
      documentArtifactFromToolResult("generate_document", {
        ok: false,
        error: "gotenberg ko",
      })
    ).toBeNull();
  });
  it("retourne null pour un outil non-effectif", () => {
    expect(
      documentArtifactFromToolResult("legifrance_search", {
        ok: true,
        data: DOC,
      })
    ).toBeNull();
  });
  it("retourne null si document_id ou filename manquent", () => {
    expect(
      documentArtifactFromToolResult("generate_document", {
        ok: true,
        data: { filename: "x.docx" },
      })
    ).toBeNull();
    expect(
      documentArtifactFromToolResult("generate_document", {
        ok: true,
        data: { document_id: "d" },
      })
    ).toBeNull();
  });
});
