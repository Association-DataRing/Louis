import { describe, it, expect, beforeAll } from "vitest";
import { generateDek, encryptWithDek, decryptWithDek, wrapDek, unwrapDek } from "./crypto-envelope";

beforeAll(() => {
  process.env.ENCRYPTION_KEY = "test-encryption-key-at-least-32-chars!!";
});

describe("crypto-envelope", () => {
  it("round-trip XChaCha20 encrypt/decrypt", async () => {
    const dek = await generateDek();
    expect(dek).toHaveLength(32);
    const plain = Buffer.from("Données juridiques confidentielles du cabinet");
    const { ciphertext, nonce } = await encryptWithDek(plain, dek);
    expect(ciphertext).not.toEqual(plain);
    const decrypted = await decryptWithDek(ciphertext, dek, nonce);
    expect(decrypted).toEqual(plain);
  });

  it("nonces uniques à chaque chiffrement", async () => {
    const dek = await generateDek();
    const plain = Buffer.from("same plaintext");
    const r1 = await encryptWithDek(plain, dek);
    const r2 = await encryptWithDek(plain, dek);
    expect(r1.nonce).not.toBe(r2.nonce);
    expect(r1.ciphertext).not.toEqual(r2.ciphertext);
  });

  it("DEK wrap/unwrap via master key", async () => {
    const dek = await generateDek();
    const wrapped = wrapDek(dek);
    const unwrapped = unwrapDek(wrapped);
    expect(Buffer.from(unwrapped)).toEqual(Buffer.from(dek));
  });

  it("décryptage échoue avec mauvais DEK", async () => {
    const dek = await generateDek();
    const plain = Buffer.from("secret");
    const { ciphertext, nonce } = await encryptWithDek(plain, dek);
    const wrongDek = await generateDek();
    await expect(decryptWithDek(ciphertext, wrongDek, nonce)).rejects.toThrow();
  });
});
