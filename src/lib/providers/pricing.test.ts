import { describe, it, expect } from "vitest";
import { computeCost, aggregateCosts } from "./pricing";

describe("computeCost: matching tolérant", () => {
  it("match exact (table)", () => {
    const c = computeCost("gpt-4o", 1_000_000, 0);
    expect(c).toEqual({ amount: 2.5, currency: "USD" });
  });

  it("nouveau modèle de famille connue (gpt-5.5 → famille gpt-5)", () => {
    const c = computeCost("gpt-5.5", 1_000_000, 0);
    expect(c).not.toBeNull();
    expect(c!.currency).toBe("USD");
    expect(c!.amount).toBeGreaterThan(0);
  });

  it("variante datée (gpt-4o-2024-08-06 → gpt-4o)", () => {
    expect(computeCost("gpt-4o-2024-08-06", 1_000_000, 0)).toEqual({
      amount: 2.5,
      currency: "USD",
    });
  });

  it("claude opus versionné (claude-opus-4-8 → famille opus-4)", () => {
    const c = computeCost("claude-opus-4-8", 1_000_000, 1_000_000);
    expect(c).toEqual({ amount: 90, currency: "USD" });
  });

  it("mini AVANT la famille générale (gpt-5-mini ≠ gpt-5)", () => {
    const mini = computeCost("gpt-5-mini", 1_000_000, 0)!;
    const full = computeCost("gpt-5", 1_000_000, 0)!;
    expect(mini.amount).toBeLessThan(full.amount);
  });

  it("modèle vraiment inconnu → null (auto-hébergé / hors table)", () => {
    expect(computeCost("un-modele-inconnu-xyz", 1000, 1000)).toBeNull();
    expect(computeCost(null, 1000, 1000)).toBeNull();
  });
});

describe("aggregateCosts: par devise, ignore les inconnus", () => {
  it("agrège EUR et USD séparément", () => {
    const totals = aggregateCosts([
      { modelId: "mistral-large-latest", inputTokens: 1_000_000, outputTokens: 0 },
      { modelId: "gpt-5.5", inputTokens: 1_000_000, outputTokens: 0 },
      { modelId: "inconnu", inputTokens: 1_000_000, outputTokens: 0 },
    ]);
    expect(totals.EUR).toBeCloseTo(2.0);
    expect(totals.USD).toBeGreaterThan(0);
  });
});
