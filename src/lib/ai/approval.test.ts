import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ToolSet } from "ai";
import {
  isApprovalGated,
  registerApproval,
  resolveApproval,
  withApprovalGates,
} from "./approval";

beforeEach(() => {
  globalThis.__louisApprovals = undefined;
  delete process.env.LOUIS_APPROVAL_TOOLS;
});

afterEach(() => {
  vi.useRealTimers();
  delete process.env.LOUIS_APPROVAL_TOOLS;
});

describe("registerApproval / resolveApproval", () => {
  it("résout true quand l'utilisateur approuve", async () => {
    const p = registerApproval({ approvalId: "a1", userId: "u1" });
    expect(resolveApproval("u1", "a1", true)).toBe(true);
    await expect(p).resolves.toBe(true);
  });

  it("refuse la résolution par un autre utilisateur", async () => {
    const p = registerApproval({ approvalId: "a1", userId: "u1" });
    expect(resolveApproval("u2", "a1", true)).toBe(false);
    expect(resolveApproval("u1", "a1", false)).toBe(true);
    await expect(p).resolves.toBe(false);
  });

  it("vaut refus au timeout", async () => {
    vi.useFakeTimers();
    const p = registerApproval({ approvalId: "a1", userId: "u1", timeoutMs: 1000 });
    vi.advanceTimersByTime(1001);
    await expect(p).resolves.toBe(false);
    // Une fois expirée, la demande n'est plus résoluble.
    expect(resolveApproval("u1", "a1", true)).toBe(false);
  });

  it("vaut refus à l'annulation du run (abort)", async () => {
    const controller = new AbortController();
    const p = registerApproval({
      approvalId: "a1",
      userId: "u1",
      abortSignal: controller.signal,
    });
    controller.abort();
    await expect(p).resolves.toBe(false);
  });
});

describe("isApprovalGated", () => {
  it("gate edit_document et les outils MCP par défaut", () => {
    expect(isApprovalGated("edit_document")).toBe(true);
    expect(isApprovalGated("mcp__jira__create_issue")).toBe(true);
    expect(isApprovalGated("generate_document")).toBe(false);
    expect(isApprovalGated("legifrance_search")).toBe(false);
  });

  it("respecte LOUIS_APPROVAL_TOOLS (liste explicite)", () => {
    process.env.LOUIS_APPROVAL_TOOLS = "generate_document,mcp";
    expect(isApprovalGated("generate_document")).toBe(true);
    expect(isApprovalGated("edit_document")).toBe(false);
    expect(isApprovalGated("mcp__x__y")).toBe(true);
  });

  it("LOUIS_APPROVAL_TOOLS vide désactive tous les gardes", () => {
    process.env.LOUIS_APPROVAL_TOOLS = "";
    expect(isApprovalGated("edit_document")).toBe(false);
    expect(isApprovalGated("mcp__x__y")).toBe(false);
  });
});

describe("withApprovalGates", () => {
  function makeTools(executed: string[]): ToolSet {
    return {
      edit_document: {
        description: "edit",
        inputSchema: { jsonSchema: { type: "object" } } as never,
        execute: async () => {
          executed.push("edit_document");
          return { ok: true, data: "edited" };
        },
      },
      legifrance_search: {
        description: "search",
        inputSchema: { jsonSchema: { type: "object" } } as never,
        execute: async () => {
          executed.push("legifrance_search");
          return { ok: true, data: "found" };
        },
      },
    };
  }

  it("exécute l'outil après approbation et bloque sur refus", async () => {
    const executed: string[] = [];
    const asked: string[] = [];
    let answer = true;
    const gated = withApprovalGates(makeTools(executed), async (name) => {
      asked.push(name);
      return answer;
    });

    const okResult = await gated.edit_document.execute!({}, {
      toolCallId: "t1",
      messages: [],
    });
    expect(okResult).toMatchObject({ ok: true });
    expect(executed).toEqual(["edit_document"]);

    answer = false;
    const denied = await gated.edit_document.execute!({}, {
      toolCallId: "t2",
      messages: [],
    });
    expect(denied).toMatchObject({ ok: false });
    expect(String((denied as { error?: string }).error)).toContain("refusée");
    expect(executed).toEqual(["edit_document"]); // pas de 2e exécution

    // Les outils non gatés ne demandent jamais d'approbation.
    await gated.legifrance_search.execute!({}, { toolCallId: "t3", messages: [] });
    expect(asked).toEqual(["edit_document", "edit_document"]);
  });

  it("sans requestApproval, les outils passent inchangés", async () => {
    const executed: string[] = [];
    const tools = withApprovalGates(makeTools(executed), undefined);
    await tools.edit_document.execute!({}, { toolCallId: "t", messages: [] });
    expect(executed).toEqual(["edit_document"]);
  });
});
