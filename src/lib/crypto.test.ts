import { describe, it, expect, beforeAll } from "vitest";
import { encrypt, decrypt, tryDecrypt, DecryptError } from "./crypto";

beforeAll(() => {
  // Clé de test stable — entropie suffisante pour passer le check length.
  process.env.ENCRYPTION_KEY = "test-key-for-vitest-do-not-use-in-prod-32+";
});

describe("crypto: round-trip", () => {
  it("encrypt then decrypt returns the original plaintext", () => {
    const plain = "sk-ant-very-secret-api-key-abcdef";
    const blob = encrypt(plain);
    expect(decrypt(blob)).toBe(plain);
  });

  it("each encrypt produces a fresh IV (no reuse)", () => {
    const a = encrypt("same input");
    const b = encrypt("same input");
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it("handles UTF-8 / accented characters", () => {
    const plain = "clé-api-éàù-中文-🔑";
    const blob = encrypt(plain);
    expect(decrypt(blob)).toBe(plain);
  });

  it("handles empty string", () => {
    const blob = encrypt("");
    expect(decrypt(blob)).toBe("");
  });

  it("handles a 4kB payload (provider keys never are this big in practice)", () => {
    const big = "x".repeat(4096);
    const blob = encrypt(big);
    expect(decrypt(blob)).toBe(big);
  });
});

describe("crypto: tampering detection", () => {
  it("decrypt fails if the auth tag is tampered", () => {
    const blob = encrypt("payload");
    const tampered = {
      ...blob,
      tag: Buffer.from(
        Buffer.from(blob.tag, "base64").map((b) => b ^ 0xff)
      ).toString("base64"),
    };
    expect(() => decrypt(tampered)).toThrow();
  });

  it("decrypt fails if the ciphertext is tampered", () => {
    const blob = encrypt("payload");
    const buf = Buffer.from(blob.ciphertext, "base64");
    buf[0] ^= 0xff;
    const tampered = { ...blob, ciphertext: buf.toString("base64") };
    expect(() => decrypt(tampered)).toThrow();
  });

  it("decrypt fails if IV is swapped", () => {
    const a = encrypt("payload-a");
    const b = encrypt("payload-b");
    expect(() => decrypt({ ...a, iv: b.iv })).toThrow();
  });

  it("decrypt throws a typed DecryptError on tampering", () => {
    const blob = encrypt("payload");
    const buf = Buffer.from(blob.ciphertext, "base64");
    buf[0] ^= 0xff;
    expect(() => decrypt({ ...blob, ciphertext: buf.toString("base64") })).toThrow(
      DecryptError
    );
  });
});

describe("crypto: fail-soft tryDecrypt", () => {
  it("ok:true avec la valeur sur un blob valide", () => {
    const blob = encrypt("secret-api-key");
    const res = tryDecrypt(blob);
    expect(res).toEqual({ ok: true, value: "secret-api-key" });
  });

  it("ok:false avec DecryptError sur un blob altéré (pas de throw)", () => {
    const blob = encrypt("payload");
    const buf = Buffer.from(blob.ciphertext, "base64");
    buf[0] ^= 0xff;
    const res = tryDecrypt({ ...blob, ciphertext: buf.toString("base64") });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBeInstanceOf(DecryptError);
  });
});

describe("crypto: missing key", () => {
  it("throws a clear error if ENCRYPTION_KEY is unset", () => {
    const original = process.env.ENCRYPTION_KEY;
    delete process.env.ENCRYPTION_KEY;
    try {
      expect(() => encrypt("x")).toThrow(/ENCRYPTION_KEY/);
    } finally {
      process.env.ENCRYPTION_KEY = original;
    }
  });

  it("throws a clear error if ENCRYPTION_KEY is too short", () => {
    const original = process.env.ENCRYPTION_KEY;
    process.env.ENCRYPTION_KEY = "short";
    try {
      // La clé étant cachée au premier appel, ce test n'invalide pas le cache
      // si encrypt a déjà été appelé avec une clé valide. On force un reset
      // en chargeant un module frais via dynamic import si nécessaire — ici
      // le test passe parce que la fonction valide la longueur AVANT le
      // cache. Si on changeait l'ordre, ce test deviendrait flaky.
      expect(() => encrypt("x")).toThrow(/too short|ENCRYPTION_KEY/);
    } finally {
      process.env.ENCRYPTION_KEY = original;
    }
  });
});
