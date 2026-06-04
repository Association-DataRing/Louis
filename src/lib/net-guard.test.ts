import { describe, it, expect, afterEach } from "vitest";
import { assertSafeUrl, SsrfError } from "./net-guard";

afterEach(() => {
  delete process.env.LOUIS_SSRF_STRICT;
});

describe("assertSafeUrl: cibles toujours bloquées", () => {
  it("bloque l'endpoint de métadonnées cloud 169.254.169.254", () => {
    expect(() => assertSafeUrl("http://169.254.169.254/latest/meta-data/")).toThrow(
      SsrfError
    );
  });

  it("bloque tout le link-local 169.254.0.0/16", () => {
    expect(() => assertSafeUrl("http://169.254.1.2:8080/")).toThrow(SsrfError);
  });

  it("bloque le link-local IPv6 fe80::", () => {
    expect(() => assertSafeUrl("http://[fe80::1]/")).toThrow(SsrfError);
  });

  it("bloque metadata.google.internal", () => {
    expect(() => assertSafeUrl("http://metadata.google.internal/")).toThrow(
      SsrfError
    );
  });

  it("bloque les protocoles non http(s)", () => {
    expect(() => assertSafeUrl("file:///etc/passwd")).toThrow(SsrfError);
    expect(() => assertSafeUrl("gopher://x/")).toThrow(SsrfError);
  });

  it("lève sur une URL invalide", () => {
    expect(() => assertSafeUrl("pas une url")).toThrow(SsrfError);
  });
});

describe("assertSafeUrl: auto-hébergement autorisé par défaut", () => {
  it("autorise localhost (Ollama)", () => {
    expect(assertSafeUrl("http://localhost:11434/v1").hostname).toBe("localhost");
  });

  it("autorise une IP LAN RFC1918 (vLLM sur le réseau du cabinet)", () => {
    expect(assertSafeUrl("http://192.168.1.50:8000/v1").hostname).toBe(
      "192.168.1.50"
    );
  });

  it("autorise un endpoint public https", () => {
    expect(assertSafeUrl("https://api.mistral.ai/v1").protocol).toBe("https:");
  });
});

describe("assertSafeUrl: mode strict (multi-tenant)", () => {
  it("bloque localhost et le LAN quand LOUIS_SSRF_STRICT=1", () => {
    process.env.LOUIS_SSRF_STRICT = "1";
    expect(() => assertSafeUrl("http://localhost:11434/")).toThrow(SsrfError);
    expect(() => assertSafeUrl("http://10.0.0.5/")).toThrow(SsrfError);
    expect(() => assertSafeUrl("http://192.168.0.1/")).toThrow(SsrfError);
    // Un endpoint public reste autorisé.
    expect(assertSafeUrl("https://api.openai.com/v1").protocol).toBe("https:");
  });
});
