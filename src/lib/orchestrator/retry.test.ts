import { describe, expect, it, vi } from "vitest";
import { isRetryableError, withRetry } from "./retry";

describe("isRetryableError", () => {
  it("retry sur HTTP 429", () => {
    expect(isRetryableError({ statusCode: 429 })).toBe(true);
  });

  it("retry sur HTTP 503", () => {
    expect(isRetryableError({ statusCode: 503 })).toBe(true);
  });

  it("retry sur HTTP 529 (Anthropic overload)", () => {
    expect(isRetryableError({ statusCode: 529 })).toBe(true);
  });

  it("PAS de retry sur 401 (clé invalide)", () => {
    expect(isRetryableError({ statusCode: 401 })).toBe(false);
  });

  it("PAS de retry sur 400 (bad request)", () => {
    expect(isRetryableError({ statusCode: 400 })).toBe(false);
  });

  it("PAS de retry sur 404 (modèle introuvable)", () => {
    expect(isRetryableError({ statusCode: 404 })).toBe(false);
  });

  it("retry sur code Mistral 3505 service_tier_capacity", () => {
    expect(
      isRetryableError({ statusCode: 429, data: { code: "3505" } })
    ).toBe(true);
  });

  it("retry sur pattern 'capacity exceeded' dans message", () => {
    expect(
      isRetryableError({
        message: "Service tier capacity exceeded for this model.",
      })
    ).toBe(true);
  });

  it("retry sur pattern 'rate limit'", () => {
    expect(isRetryableError({ message: "rate_limit_exceeded" })).toBe(true);
  });

  it("retry sur pattern 'overload'", () => {
    expect(isRetryableError({ message: "Anthropic is overloaded" })).toBe(true);
  });

  it("retry sur ECONNRESET", () => {
    expect(isRetryableError({ message: "ECONNRESET" })).toBe(true);
  });

  it("traverse AI_RetryError → lastError", () => {
    const err = {
      message: "Failed after 3 attempts",
      lastError: { statusCode: 429 },
    };
    expect(isRetryableError(err)).toBe(true);
  });

  it("traverse AI_RetryError → errors[last]", () => {
    const err = {
      message: "Failed after 3 attempts",
      errors: [{ statusCode: 500 }, { statusCode: 429 }],
    };
    expect(isRetryableError(err)).toBe(true);
  });

  it("retourne false sur null/undefined/string", () => {
    expect(isRetryableError(null)).toBe(false);
    expect(isRetryableError(undefined)).toBe(false);
    expect(isRetryableError("oops")).toBe(false);
  });

  it("retourne false sur message inconnu", () => {
    expect(
      isRetryableError({ message: "Invalid request payload" })
    ).toBe(false);
  });
});

describe("withRetry", () => {
  it("retourne le résultat au premier essai si succès", async () => {
    const fn = vi.fn(async () => "ok");
    const result = await withRetry(fn, { backoffMs: [10] });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retry sur erreur transitoire, succès au 2e essai", async () => {
    let calls = 0;
    const fn = vi.fn(async () => {
      calls++;
      if (calls === 1) {
        const err = new Error("rate_limit_exceeded") as Error & {
          statusCode: number;
        };
        err.statusCode = 429;
        throw err;
      }
      return "ok";
    });

    const result = await withRetry(fn, { backoffMs: [5] });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("propage l'erreur permanente sans retry", async () => {
    const fn = vi.fn(async () => {
      const err = new Error("invalid_api_key") as Error & {
        statusCode: number;
      };
      err.statusCode = 401;
      throw err;
    });

    await expect(
      withRetry(fn, { backoffMs: [5, 10] })
    ).rejects.toThrow("invalid_api_key");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("propage l'erreur transitoire après épuisement des retries", async () => {
    const fn = vi.fn(async () => {
      const err = new Error("rate_limit_exceeded") as Error & {
        statusCode: number;
      };
      err.statusCode = 429;
      throw err;
    });

    await expect(
      withRetry(fn, { backoffMs: [5, 5] })
    ).rejects.toThrow("rate_limit_exceeded");
    expect(fn).toHaveBeenCalledTimes(3); // 1 + 2 retries
  });

  it("appelle onRetry à chaque tentative", async () => {
    const onRetry = vi.fn();
    let calls = 0;
    const fn = async () => {
      calls++;
      if (calls < 3) {
        const err = new Error("overload") as Error & { statusCode: number };
        err.statusCode = 529;
        throw err;
      }
      return "ok";
    };

    const result = await withRetry(fn, {
      backoffMs: [5, 10, 20],
      onRetry,
    });
    expect(result).toBe("ok");
    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenNthCalledWith(1, 1, 5, expect.anything());
    expect(onRetry).toHaveBeenNthCalledWith(2, 2, 10, expect.anything());
  });

  it("respecte le maxAttempts personnalisé", async () => {
    const fn = vi.fn(async () => {
      const err = new Error("overload") as Error & { statusCode: number };
      err.statusCode = 503;
      throw err;
    });
    await expect(
      withRetry(fn, { maxAttempts: 2, backoffMs: [5, 5, 5] })
    ).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
