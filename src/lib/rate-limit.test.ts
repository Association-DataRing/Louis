import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

// Mock du module Redis avant l'import du sujet — sinon ioredis tente une
// connexion au démarrage du test runner.
vi.mock("./redis", () => {
  const counts = new Map<string, number>();
  const fake = {
    async incr(key: string): Promise<number> {
      const next = (counts.get(key) ?? 0) + 1;
      counts.set(key, next);
      return next;
    },
    async expire(): Promise<number> {
      return 1;
    },
  };
  return {
    getRedis: () => fake,
    getRedisReady: async () => fake,
  };
});

import { rateLimit, rateLimitHeaders, tooManyRequests } from "./rate-limit";

describe("rate-limit: limit=0 désactive le bucket", () => {
  beforeAll(() => {
    process.env.RATE_LIMIT_CHAT_PER_MINUTE = "0";
  });
  afterAll(() => {
    delete process.env.RATE_LIMIT_CHAT_PER_MINUTE;
  });

  it("autorise une infinité de requêtes quand max = 0", async () => {
    for (let i = 0; i < 100; i++) {
      const r = await rateLimit("chat", "user-A");
      expect(r.allowed).toBe(true);
    }
  });
});

describe("rate-limit: comportement de la fenêtre", () => {
  beforeAll(() => {
    process.env.RATE_LIMIT_UPLOAD_PER_HOUR = "3";
  });
  afterAll(() => {
    delete process.env.RATE_LIMIT_UPLOAD_PER_HOUR;
  });

  it("autorise jusqu'à `max` requêtes puis bloque", async () => {
    // identifiant unique par test pour éviter la pollution croisée du mock
    const id = `user-${Math.random().toString(36).slice(2)}`;
    const a = await rateLimit("upload", id);
    const b = await rateLimit("upload", id);
    const c = await rateLimit("upload", id);
    const d = await rateLimit("upload", id);

    expect(a.allowed).toBe(true);
    expect(b.allowed).toBe(true);
    expect(c.allowed).toBe(true);
    expect(d.allowed).toBe(false);
  });

  it("compte les identifiants séparément", async () => {
    const a = await rateLimit("upload", "userX");
    const b = await rateLimit("upload", "userY");
    expect(a.allowed).toBe(true);
    expect(b.allowed).toBe(true);
  });
});

describe("rate-limit: helpers HTTP", () => {
  it("rateLimitHeaders renvoie les 3 headers IETF", () => {
    const headers = rateLimitHeaders({
      allowed: true,
      remaining: 5,
      resetAt: Date.now() + 60_000,
      limit: 10,
    });
    expect(headers["RateLimit-Limit"]).toBe("10");
    expect(headers["RateLimit-Remaining"]).toBe("5");
    expect(Number(headers["RateLimit-Reset"])).toBeGreaterThan(0);
  });

  it("tooManyRequests renvoie 429 avec Retry-After", () => {
    const res = tooManyRequests({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 30_000,
      limit: 10,
    });
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeDefined();
    expect(res.headers.get("RateLimit-Limit")).toBe("10");
  });
});
