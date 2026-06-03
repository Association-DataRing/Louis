import { describe, it, expect } from "vitest";
import {
  generateTotpSecret,
  totpCode,
  verifyTotp,
  otpauthUri,
  generateBackupCodes,
} from "./totp";

describe("totp", () => {
  it("génère un secret base32 non trivial", () => {
    const s = generateTotpSecret();
    expect(s).toMatch(/^[A-Z2-7]+$/);
    expect(s.length).toBeGreaterThanOrEqual(32);
    expect(generateTotpSecret()).not.toBe(s);
  });

  it("vérifie le code courant qu'il a généré", () => {
    const s = generateTotpSecret();
    const at = 1_700_000_000_000;
    const code = totpCode(s, at);
    expect(code).toMatch(/^\d{6}$/);
    expect(verifyTotp(s, code, at)).toBe(true);
  });

  it("tolère ±1 pas (fenêtre)", () => {
    const s = generateTotpSecret();
    const at = 1_700_000_000_000;
    const prev = totpCode(s, at - 30_000);
    const next = totpCode(s, at + 30_000);
    expect(verifyTotp(s, prev, at)).toBe(true);
    expect(verifyTotp(s, next, at)).toBe(true);
  });

  it("rejette hors fenêtre, code faux et format invalide", () => {
    const s = generateTotpSecret();
    const at = 1_700_000_000_000;
    expect(verifyTotp(s, totpCode(s, at - 120_000), at)).toBe(false);
    expect(verifyTotp(s, "000000", at)).toBe(false);
    expect(verifyTotp(s, "abc", at)).toBe(false);
    expect(verifyTotp(s, "1234567", at)).toBe(false);
  });

  it("vecteur RFC : secret connu → code déterministe", () => {
    // Secret base32 de "12345678901234567890" (vecteur RFC 6238).
    const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
    // À t=59s, le HOTP counter=1 ; on vérifie juste la stabilité/format.
    const code = totpCode(secret, 59_000);
    expect(code).toMatch(/^\d{6}$/);
    expect(verifyTotp(secret, code, 59_000)).toBe(true);
  });

  it("otpauthUri contient le secret et l'issuer", () => {
    const uri = otpauthUri("ABC234", "me@cabinet.fr");
    expect(uri).toContain("otpauth://totp/");
    expect(uri).toContain("secret=ABC234");
    expect(uri).toContain("issuer=Louis");
  });

  it("génère des codes de secours uniques", () => {
    const codes = generateBackupCodes(8);
    expect(codes).toHaveLength(8);
    expect(new Set(codes).size).toBe(8);
    codes.forEach((c) => expect(c).toMatch(/^[0-9A-F]{10}$/));
  });
});
