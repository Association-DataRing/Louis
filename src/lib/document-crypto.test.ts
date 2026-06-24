import { describe, it, expect, beforeAll } from "vitest";
import { decryptDocumentText } from "./document-crypto";
import { generateDek, encryptWithDek, wrapDek } from "./crypto-envelope";

beforeAll(() => {
  process.env.ENCRYPTION_KEY = "test-encryption-key-at-least-32-chars!!";
});

describe("decryptDocumentText", () => {
  it("rétro-compat : retourne extractedText brut si encDek est null", async () => {
    const result = await decryptDocumentText({
      encDek: null,
      encExtractedText: null,
      extractedTextNonce: null,
      extractedText: "texte juridique en clair (document pré-chiffrement)",
    });
    expect(result).toBe("texte juridique en clair (document pré-chiffrement)");
  });

  it("retourne null si encDek présent mais encExtractedText absent", async () => {
    const dek = await generateDek();
    const encDek = wrapDek(dek);
    const result = await decryptDocumentText({
      encDek,
      encExtractedText: null,
      extractedTextNonce: null,
      extractedText: null,
    });
    expect(result).toBeNull();
  });

  it("déchiffre correctement un texte chiffré par enveloppe DEK", async () => {
    const plaintext =
      "# Contrat de mission\n\nLe client confie au cabinet la défense de ses intérêts.";
    const dek = await generateDek();
    const { ciphertext, nonce } = await encryptWithDek(
      Buffer.from(plaintext, "utf8"),
      dek
    );
    const encDek = wrapDek(dek);

    const result = await decryptDocumentText({
      encDek,
      encExtractedText: ciphertext.toString("base64"),
      extractedTextNonce: nonce,
      extractedText: null,
    });
    expect(result).toBe(plaintext);
  });

  it("préserve le Markdown après chiffrement/déchiffrement", async () => {
    const markdown =
      "## Article 1 — Objet\n\nLa présente convention a pour objet...\n\n- Point A\n- Point B";
    const dek = await generateDek();
    const { ciphertext, nonce } = await encryptWithDek(
      Buffer.from(markdown, "utf8"),
      dek
    );
    const encDek = wrapDek(dek);

    const result = await decryptDocumentText({
      encDek,
      encExtractedText: ciphertext.toString("base64"),
      extractedTextNonce: nonce,
      extractedText: null,
    });
    expect(result).toContain("## Article 1");
    expect(result).toContain("- Point A");
  });

  it("échoue proprement avec un DEK incorrect (mauvaise master key simulée)", async () => {
    const dek = await generateDek();
    const { ciphertext, nonce } = await encryptWithDek(
      Buffer.from("secret", "utf8"),
      dek
    );
    // encDek chiffré avec la bonne master key, mais ciphertext trafiqué.
    const encDek = wrapDek(dek);
    const tamperedCiphertext = Buffer.from(ciphertext);
    tamperedCiphertext[0] ^= 0xff; // flip un byte → MAC invalide

    await expect(
      decryptDocumentText({
        encDek,
        encExtractedText: tamperedCiphertext.toString("base64"),
        extractedTextNonce: nonce,
        extractedText: null,
      })
    ).rejects.toThrow();
  });
});
