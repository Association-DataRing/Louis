import { describe, it, expect } from "vitest";
import type { ToolSet } from "ai";
import {
  resolveAgentRag,
  omitDocumentaryRagTools,
  DOCUMENTARY_RAG_TOOLS,
} from "./rag-scope";
import type { AgentContext } from "../types";

function projectCtx(): AgentContext {
  return {
    userId: "u-1",
    conversationId: "c-1",
    messages: [],
    projectId: "p-1",
    projectDocumentIds: ["d-1", "d-2"],
    projectFolderId: "f-root",
  };
}

function globalCtx(): AgentContext {
  return { userId: "u-1", conversationId: "c-1", messages: [] };
}

describe("resolveAgentRag", () => {
  it("inherit (null) en conversation projet = périmètre conversation", async () => {
    const { scope, hideDocumentaryRag } = await resolveAgentRag(
      projectCtx(),
      null
    );
    expect(hideDocumentaryRag).toBe(false);
    expect(scope).toEqual({
      projectId: "p-1",
      conversationId: "c-1",
      documentIds: ["d-1", "d-2"],
      folderId: "f-root",
    });
  });

  it("inherit explicite = même périmètre", async () => {
    const { scope } = await resolveAgentRag(projectCtx(), { mode: "inherit" });
    expect(scope?.documentIds).toEqual(["d-1", "d-2"]);
  });

  it("project = périmètre projet complet (comme inherit en conv. projet)", async () => {
    const { scope, hideDocumentaryRag } = await resolveAgentRag(projectCtx(), {
      mode: "project",
    });
    expect(hideDocumentaryRag).toBe(false);
    expect(scope?.documentIds).toEqual(["d-1", "d-2"]);
  });

  it("none en conversation projet vide les documents + masque les outils", async () => {
    const { scope, hideDocumentaryRag } = await resolveAgentRag(projectCtx(), {
      mode: "none",
    });
    expect(hideDocumentaryRag).toBe(true);
    expect(scope?.documentIds).toEqual([]);
    // le reste du scope projet est conservé (destination des docs générés)
    expect(scope?.folderId).toBe("f-root");
  });

  it("none en conversation globale masque les outils (pas de scope)", async () => {
    const { scope, hideDocumentaryRag } = await resolveAgentRag(globalCtx(), {
      mode: "none",
    });
    expect(hideDocumentaryRag).toBe(true);
    expect(scope).toBeUndefined();
  });

  it("conversation globale + inherit = aucun scope (RAG global inchangé)", async () => {
    const { scope, hideDocumentaryRag } = await resolveAgentRag(
      globalCtx(),
      null
    );
    expect(hideDocumentaryRag).toBe(false);
    expect(scope).toBeUndefined();
  });
});

describe("omitDocumentaryRagTools", () => {
  it("retire exactement les outils de lecture documentaire", () => {
    const tools = {
      search_documents: {},
      list_documents: {},
      read_document: {},
      find_in_document: {},
      generate_document: {},
      edit_document: {},
      legifrance_search: {},
      search_conversation_history: {},
    } as unknown as ToolSet;

    const out = omitDocumentaryRagTools(tools);
    for (const t of DOCUMENTARY_RAG_TOOLS) {
      expect(out).not.toHaveProperty(t);
    }
    // création + connecteurs + historique conservés
    expect(out).toHaveProperty("generate_document");
    expect(out).toHaveProperty("edit_document");
    expect(out).toHaveProperty("legifrance_search");
    expect(out).toHaveProperty("search_conversation_history");
  });
});
