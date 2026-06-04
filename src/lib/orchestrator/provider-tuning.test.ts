import { describe, it, expect } from "vitest";
import type { ModelMessage } from "ai";
import { applyCachedSystem } from "./provider-tuning";

const messages: ModelMessage[] = [{ role: "user", content: "bonjour" }];

describe("applyCachedSystem", () => {
  it("Anthropic + outils → système déplacé en message avec cacheControl éphémère", () => {
    const out = applyCachedSystem({
      keyType: "anthropic",
      system: "PROMPT JURIDIQUE",
      messages,
      hasTools: true,
    });
    expect(out.system).toBeUndefined();
    expect(out.messages[0]).toMatchObject({
      role: "system",
      content: "PROMPT JURIDIQUE",
      providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } },
    });
    // L'historique d'origine suit le message système.
    expect(out.messages.slice(1)).toEqual(messages);
  });

  it("Anthropic + long système sans outils → caché aussi", () => {
    const out = applyCachedSystem({
      keyType: "anthropic",
      system: "x".repeat(2000),
      messages,
      hasTools: false,
    });
    expect(out.system).toBeUndefined();
    expect(out.messages[0].role).toBe("system");
  });

  it("Anthropic mais préfixe trop court sans outils → pas de breakpoint", () => {
    const out = applyCachedSystem({
      keyType: "anthropic",
      system: "court",
      messages,
      hasTools: false,
    });
    expect(out.system).toBe("court");
    expect(out.messages).toBe(messages);
  });

  it("provider non-Anthropic → système inchangé (param string)", () => {
    const out = applyCachedSystem({
      keyType: "mistral",
      system: "PROMPT",
      messages,
      hasTools: true,
    });
    expect(out.system).toBe("PROMPT");
    expect(out.messages).toBe(messages);
  });
});
