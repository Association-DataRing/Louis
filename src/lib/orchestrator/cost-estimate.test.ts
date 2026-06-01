import { describe, expect, it } from "vitest";
import {
  estimateCalls,
  estimateRunCost,
  estimateTokensFromChars,
} from "./cost-estimate";

describe("estimateCalls", () => {
  it("council 3 agents / 2 tours = 5 appels", () => {
    expect(estimateCalls({ mode: "council", agents: 3, rounds: 2 })).toBe(5);
  });

  it("sequential 3 agents = 3 appels", () => {
    expect(estimateCalls({ mode: "sequential", agents: 3 })).toBe(3);
  });

  it("parallel 3 agents = 3 appels (2 workers + 1 synthèse)", () => {
    expect(estimateCalls({ mode: "parallel", agents: 3 })).toBe(3);
  });

  it("council 1 tour par défaut", () => {
    expect(estimateCalls({ mode: "council", agents: 4 })).toBe(4); // 1*(4-1)+1
  });

  it("mono-agent (ou vide) = 1 appel quel que soit le mode", () => {
    expect(estimateCalls({ mode: "council", agents: 1, rounds: 3 })).toBe(1);
    expect(estimateCalls({ mode: "sequential", agents: 0 })).toBe(1);
    expect(estimateCalls({ mode: "parallel", agents: 1 })).toBe(1);
  });

  it("council 5 agents / 4 tours = 17 appels", () => {
    expect(estimateCalls({ mode: "council", agents: 5, rounds: 4 })).toBe(17);
  });
});

describe("estimateTokensFromChars", () => {
  it("≈ 4 caractères par token", () => {
    expect(estimateTokensFromChars(0)).toBe(0);
    expect(estimateTokensFromChars(4)).toBe(1);
    expect(estimateTokensFromChars(10)).toBe(3); // ceil(2.5)
    expect(estimateTokensFromChars(-5)).toBe(0);
  });
});

describe("estimateRunCost", () => {
  it("null pour un modèle sans prix connu (auto-hébergé / hors table)", () => {
    expect(
      estimateRunCost({ modelId: "ollama-local", calls: 3, promptChars: 400 })
    ).toBeNull();
    expect(
      estimateRunCost({ modelId: null, calls: 1, promptChars: 100 })
    ).toBeNull();
  });

  it("coût > 0 et croissant avec le nombre d'appels pour un modèle tarifé", () => {
    const one = estimateRunCost({
      modelId: "claude-opus-4-7",
      calls: 1,
      promptChars: 400,
    });
    const five = estimateRunCost({
      modelId: "claude-opus-4-7",
      calls: 5,
      promptChars: 400,
    });
    expect(one?.amount).toBeGreaterThan(0);
    expect(five?.amount).toBeGreaterThan(one!.amount);
    expect(one?.currency).toBe("USD");
  });
});
