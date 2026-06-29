/**
 * Décodage des résultats d'outils (ToolResult) — source UNIQUE partagée
 * serveur + client.
 *
 * L'AI SDK v6 emballe la sortie d'un tool dans `{ type: "json", value: {...} }`
 * (ou `{ type: "text", text: "<json>" }` pour les retours scalaires). Nos tools
 * renvoient ensuite une enveloppe métier `{ ok: true, data: {...} }` (toolOk) ou
 * `{ ok: false, error }`. Centraliser le décodage évite que serveur (persistance,
 * audit) et client (rendu) divergent sur la forme de l'enveloppe — divergence
 * qui causait à la fois la perte de la carte d'artefact et de faux
 * « deliverable.failed » dans l'audit.
 */

/**
 * Retire les couches d'enveloppe AI SDK (string JSON, `{type:"json",value}`,
 * `{type:"text",text}`) pour exposer l'objet ToolResult brut `{ ok, data, error }`.
 * Ne juge PAS le succès — préserve `ok:false` (à la différence de
 * `unwrapToolResult`). Retourne null si la valeur n'est pas un objet exploitable.
 */
function peelToolEnvelope(o: unknown): Record<string, unknown> | null {
  let candidate: unknown = o;
  if (candidate == null) return null;

  // Couche 1 : string JSON.
  if (typeof candidate === "string") {
    try {
      candidate = JSON.parse(candidate);
    } catch {
      return null;
    }
  }
  if (typeof candidate !== "object" || candidate === null) return null;

  // Couche 2 : enveloppe AI SDK { type, value/text }.
  const ai = candidate as Record<string, unknown>;
  if ("type" in ai && "value" in ai && ai.type === "json") {
    candidate = ai.value;
  } else if ("type" in ai && "text" in ai && ai.type === "text") {
    try {
      candidate = JSON.parse(String(ai.text));
    } catch {
      return null;
    }
  }
  if (typeof candidate !== "object" || candidate === null) return null;

  return candidate as Record<string, unknown>;
}

/**
 * Récupère la `data` métier d'un ToolResult réussi, sinon null
 * (`ok:false` ou non-résultat → null). Pour le rendu/extraction côté client.
 */
export function unwrapToolResult<T>(o: unknown): T | null {
  const env = peelToolEnvelope(o);
  if (!env) return null;
  // Échec explicite → pas de data exploitable (même sans champ `data`).
  if ("ok" in env && env.ok === false) return null;
  if ("ok" in env && "data" in env) return env.data as T;
  return env as T;
}

/**
 * Lit le statut d'un ToolResult, enveloppe-agnostique, en PRÉSERVANT l'échec.
 * Utilisé par l'audit de livrable (verify.ts) qui doit distinguer succès et
 * échec silencieux d'un outil effectif. `ok` vaut false par défaut.
 */
export function toolResultOk(o: unknown): { ok: boolean; error?: string } {
  const env = peelToolEnvelope(o);
  const ok = !!(env && env.ok === true);
  const error =
    env && typeof env.error === "string" ? (env.error as string) : undefined;
  return { ok, error };
}

/** Métadonnée d'artefact document persistée dans `messages.metadata.documents`. */
export type DocumentArtifactMeta = {
  documentId: string;
  filename: string;
  format: "docx" | "pdf";
  kind: "generated" | "edited";
};

const DOC_TOOL_KINDS: Record<string, DocumentArtifactMeta["kind"]> = {
  generate_document: "generated",
  edit_document: "edited",
};

/**
 * Si `output` est le résultat réussi d'un outil document (generate/edit),
 * retourne son artefact canonique (id, nom, format, type) — sinon null.
 * Indépendant de l'enveloppe et de la prose du modèle.
 */
export function documentArtifactFromToolResult(
  toolName: string,
  output: unknown
): DocumentArtifactMeta | null {
  const kind = DOC_TOOL_KINDS[toolName];
  if (!kind) return null;
  const data = unwrapToolResult<{
    document_id?: unknown;
    filename?: unknown;
    format?: unknown;
  }>(output);
  if (
    !data ||
    typeof data.document_id !== "string" ||
    typeof data.filename !== "string"
  ) {
    return null;
  }
  return {
    documentId: data.document_id,
    filename: data.filename,
    format: data.format === "pdf" ? "pdf" : "docx",
    kind,
  };
}
