import { describe, it, expect, afterEach } from "vitest";
import type { ModelMessage } from "ai";
import {
  resolveContextBudgetTokens,
  estimateMessagesTokens,
  trimMessages,
} from "./context-budget";

afterEach(() => {
  delete process.env.LOUIS_CONTEXT_BUDGET_TOKENS;
});

describe("resolveContextBudgetTokens", () => {
  it("défaut 100k sans override", () => {
    expect(resolveContextBudgetTokens()).toBe(100_000);
  });
  it("respecte LOUIS_CONTEXT_BUDGET_TOKENS", () => {
    process.env.LOUIS_CONTEXT_BUDGET_TOKENS = "6000";
    expect(resolveContextBudgetTokens()).toBe(6000);
  });
  it("ignore une valeur invalide", () => {
    process.env.LOUIS_CONTEXT_BUDGET_TOKENS = "abc";
    expect(resolveContextBudgetTokens()).toBe(100_000);
  });
});

const u = (content: string): ModelMessage => ({ role: "user", content });
const a = (content: string): ModelMessage => ({ role: "assistant", content });

describe("trimMessages", () => {
  it("no-op sous le budget", () => {
    const msgs = [u("a"), a("b"), u("c")];
    expect(trimMessages(msgs, 100_000)).toBe(msgs);
  });

  it("ne touche pas un historique <= 2 messages même si gros", () => {
    const msgs = [u("x".repeat(10_000)), u("y".repeat(10_000))];
    expect(trimMessages(msgs, 10)).toBe(msgs);
  });

  it("rogne les plus anciens et garde les 2 derniers", () => {
    const msgs = [
      u("vieux".repeat(1000)),
      a("vieux".repeat(1000)),
      u("récent court"),
      a("réponse récente"),
    ];
    const out = trimMessages(msgs, 100); // budget minuscule → rogne
    expect(out.length).toBeLessThan(msgs.length);
    expect(out.at(-1)).toEqual(msgs.at(-1));
    expect(out.at(-2)).toEqual(msgs.at(-2));
  });

  it("estimation des tokens monotone avec la taille", () => {
    expect(estimateMessagesTokens([u("court")])).toBeLessThan(
      estimateMessagesTokens([u("x".repeat(4000))])
    );
  });
});

describe("trimMessages: sanitization des paires tool", () => {
  it("supprime un tool-result orphelin laissé en tête après rognage", () => {
    // L'assistant qui appelait l'outil (call-1) est ancien et sera rogné ;
    // son résultat orphelin ne doit pas rester en tête (sinon 400 provider).
    const msgs: ModelMessage[] = [
      {
        role: "assistant",
        content: [
          { type: "tool-call", toolCallId: "call-1", toolName: "legifrance_search", input: {} },
        ],
      },
      {
        role: "tool",
        content: [
          { type: "tool-result", toolCallId: "call-1", toolName: "legifrance_search", output: { type: "text", value: "r".repeat(8000) } },
        ],
      },
      u("question récente"),
      a("réponse"),
    ];
    const out = trimMessages(msgs, 50); // force le rognage de l'assistant ancien
    // Aucun tool-result orphelin (call-1) ne subsiste.
    const hasOrphan = out.some(
      (m) =>
        m.role === "tool" &&
        Array.isArray(m.content) &&
        m.content.some(
          (p) => p.type === "tool-result" && p.toolCallId === "call-1"
        )
    );
    expect(hasOrphan).toBe(false);
    expect(out.at(-1)).toEqual(msgs.at(-1));
  });

  it("conserve une paire tool-call/tool-result intacte", () => {
    const msgs: ModelMessage[] = [
      {
        role: "assistant",
        content: [
          { type: "tool-call", toolCallId: "c1", toolName: "t", input: {} },
        ],
      },
      {
        role: "tool",
        content: [
          { type: "tool-result", toolCallId: "c1", toolName: "t", output: { type: "text", value: "ok" } },
        ],
      },
      u("suite"),
    ];
    // Sous budget → no-op, la paire reste.
    expect(trimMessages(msgs, 100_000)).toBe(msgs);
  });
});
