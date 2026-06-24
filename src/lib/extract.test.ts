import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @/lib/pdf/to-markdown pour isoler extractText des dépendances pdfjs/canvas.
const pdfState = vi.hoisted(() => ({ returnValue: "# Titre\n\nContenu extrait." }));

vi.mock("@/lib/pdf/to-markdown", () => ({
  pdfToMarkdown: vi.fn(async () => pdfState.returnValue),
}));

import {
  extractText,
  ScannedPdfError,
  PDF_MEDIA_TYPE,
  TEXT_MEDIA_TYPE,
} from "./extract";

beforeEach(() => {
  pdfState.returnValue = "# Titre\n\nContenu extrait suffisamment long.";
});

describe("extractText", () => {
  describe("text/plain", () => {
    it("retourne le texte brut avec format='text'", async () => {
      const input = "Texte d'une convention d'honoraires.";
      const result = await extractText(Buffer.from(input), TEXT_MEDIA_TYPE);
      expect(result.text).toBe(input);
      expect(result.format).toBe("text");
      expect(result.truncated).toBe(false);
    });

    it("tronque au-delà de 500 000 caractères", async () => {
      const long = "x".repeat(600_000);
      const result = await extractText(Buffer.from(long), TEXT_MEDIA_TYPE);
      expect(result.truncated).toBe(true);
      expect(result.text.length).toBe(500_000);
    });
  });

  describe("application/pdf", () => {
    it("retourne format='markdown' pour un PDF avec couche texte", async () => {
      const result = await extractText(Buffer.from(""), PDF_MEDIA_TYPE);
      expect(result.format).toBe("markdown");
      expect(result.truncated).toBe(false);
      expect(result.text).toContain("Contenu extrait");
    });

    it("lève ScannedPdfError si pdfToMarkdown retourne du texte quasi-vide", async () => {
      pdfState.returnValue = "   ";
      await expect(
        extractText(Buffer.from(""), PDF_MEDIA_TYPE)
      ).rejects.toBeInstanceOf(ScannedPdfError);
    });

    it("lève ScannedPdfError si pdfToMarkdown retourne une chaîne vide", async () => {
      pdfState.returnValue = "";
      await expect(
        extractText(Buffer.from(""), PDF_MEDIA_TYPE)
      ).rejects.toBeInstanceOf(ScannedPdfError);
    });
  });

  describe("type non supporté", () => {
    it("lève une erreur pour un type MIME inconnu", async () => {
      await expect(
        extractText(Buffer.from(""), "application/octet-stream")
      ).rejects.toThrow("Unsupported content type");
    });
  });
});
