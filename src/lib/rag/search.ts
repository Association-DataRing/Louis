import { sql } from "drizzle-orm";
import { db } from "@/db";
import { embedQuery, NoEmbeddingProviderError } from "./embed";

export type RagHit = {
  documentId: string;
  filename: string;
  chunkIndex: number;
  content: string;
  similarity: number;
};

// Pondération de la fusion hybride : le vecteur capte la proximité sémantique,
// le mot-clé (FTS français) garantit le rappel des tokens EXACTS qui dominent
// les requêtes juridiques (n° d'article, n° de pourvoi, nom de partie, terme
// défini). Sans la composante mot-clé, « la clause à l'article 8 » ne remonte
// pas forcément le chunk contenant littéralement « article 8 ».
const VECTOR_WEIGHT = 0.7;
const KEYWORD_WEIGHT = 0.3;

/** Construit la condition de périmètre documentaire (user + sous-ensemble). */
function scopeClause(userId: string, documentIds?: string[]) {
  const base = sql`d.user_id = ${userId}`;
  if (documentIds?.length) {
    const ids = sql.join(
      documentIds.map((id) => sql`${id}::uuid`),
      sql`, `
    );
    return sql`${base} AND d.id IN (${ids})`;
  }
  return base;
}

/**
 * Recherche HYBRIDE (vecteur + mot-clé) sur les documents de l'utilisateur.
 * Récupère 3×limit candidats par voie (HNSW pour le vecteur, GIN FTS pour le
 * mot-clé), puis fusionne les scores. Dégrade en recherche mot-clé pure quand
 * aucun backend d'embedding n'est disponible (déploiement air-gapped sans
 * Mistral/endpoint local) — la recherche reste fonctionnelle.
 */
export async function ragSearch(
  userId: string,
  query: string,
  options?: { documentIds?: string[]; limit?: number }
): Promise<RagHit[]> {
  const limit = options?.limit ?? 6;
  const candidates = limit * 3;
  const scope = scopeClause(userId, options?.documentIds);

  let queryEmbedding: number[] | null = null;
  try {
    queryEmbedding = await embedQuery(userId, query);
  } catch (err) {
    // Dégradation gracieuse : pas d'embedding → on bascule en mot-clé pur
    // plutôt que de ne rien retourner.
    if (!(err instanceof NoEmbeddingProviderError)) throw err;
  }

  if (!queryEmbedding) {
    const rows = await db.execute(sql`
      SELECT dc.document_id AS "documentId", d.filename AS "filename",
             dc.chunk_index AS "chunkIndex", dc.content AS "content",
             ts_rank(to_tsvector('french', dc.content),
                     websearch_to_tsquery('french', ${query})) AS "similarity"
      FROM document_chunks dc
      JOIN documents d ON d.id = dc.document_id
      WHERE ${scope}
        AND to_tsvector('french', dc.content) @@ websearch_to_tsquery('french', ${query})
      ORDER BY "similarity" DESC
      LIMIT ${limit}
    `);
    return rows as unknown as RagHit[];
  }

  const vecLiteral = `[${queryEmbedding.join(",")}]`;
  const rows = await db.execute(sql`
    WITH q AS (
      SELECT websearch_to_tsquery('french', ${query}) AS tsq,
             ${vecLiteral}::vector AS vec
    ),
    vec AS (
      SELECT dc.id, 1 - (dc.embedding <=> (SELECT vec FROM q)) AS vec_sim
      FROM document_chunks dc
      JOIN documents d ON d.id = dc.document_id
      WHERE ${scope} AND dc.embedding IS NOT NULL
      ORDER BY dc.embedding <=> (SELECT vec FROM q)
      LIMIT ${candidates}
    ),
    kw AS (
      SELECT dc.id, ts_rank(to_tsvector('french', dc.content), (SELECT tsq FROM q)) AS kw_rank
      FROM document_chunks dc
      JOIN documents d ON d.id = dc.document_id
      WHERE ${scope} AND to_tsvector('french', dc.content) @@ (SELECT tsq FROM q)
      ORDER BY kw_rank DESC
      LIMIT ${candidates}
    )
    SELECT dc.document_id AS "documentId", d.filename AS "filename",
           dc.chunk_index AS "chunkIndex", dc.content AS "content",
           (${VECTOR_WEIGHT} * COALESCE(v.vec_sim, 0)
            + ${KEYWORD_WEIGHT} * LEAST(COALESCE(k.kw_rank, 0), 1.0)) AS "similarity"
    FROM document_chunks dc
    JOIN documents d ON d.id = dc.document_id
    LEFT JOIN vec v ON v.id = dc.id
    LEFT JOIN kw k ON k.id = dc.id
    WHERE v.id IS NOT NULL OR k.id IS NOT NULL
    ORDER BY "similarity" DESC
    LIMIT ${limit}
  `);
  return rows as unknown as RagHit[];
}
