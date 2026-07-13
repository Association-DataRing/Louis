import { sql } from "drizzle-orm";
import { db } from "@/db";
import { messageChunks } from "@/db/schema";
import { chunkText } from "./chunk";
import { embedQuery, embedTexts, NoEmbeddingProviderError } from "./embed";

export type MessageHit = {
  conversationId: string;
  conversationTitle: string;
  role: string;
  content: string;
  createdAt: Date;
  similarity: number;
};

// Mêmes poids que la recherche documentaire (cf. rag/search.ts).
const VECTOR_WEIGHT = 0.7;
const KEYWORD_WEIGHT = 0.3;

/**
 * Recherche HYBRIDE (vecteur + mot-clé) dans l'historique des conversations
 * d'un projet. Jointure message_chunks → messages → conversations pour ne
 * garder que les conversations de l'utilisateur rattachées au projet. La
 * conversation courante peut être exclue. Dégrade en mot-clé pur sans embedding.
 */
export async function searchProjectMessages(
  userId: string,
  projectId: string,
  query: string,
  options?: { excludeConversationId?: string | null; limit?: number }
): Promise<MessageHit[]> {
  const limit = options?.limit ?? 6;
  const candidates = limit * 3;
  const exclude = options?.excludeConversationId ?? null;
  // Périmètre = le projet (frontière d'autorisation, déjà vérifiée en amont).
  // Pas de filtre c.user_id : l'historique d'un projet partagé couvre les
  // conversations de TOUS les membres (collaboration).
  const scope = exclude
    ? sql`c.project_id = ${projectId} AND c.id <> ${exclude}::uuid`
    : sql`c.project_id = ${projectId}`;

  let queryEmbedding: number[] | null = null;
  try {
    queryEmbedding = await embedQuery(userId, query);
  } catch (err) {
    if (!(err instanceof NoEmbeddingProviderError)) throw err;
  }

  if (!queryEmbedding) {
    const rows = await db.execute(sql`
      SELECT c.id AS "conversationId", c.title AS "conversationTitle",
             m.role AS "role", mc.content AS "content", m.created_at AS "createdAt",
             ts_rank(to_tsvector('french', mc.content),
                     websearch_to_tsquery('french', ${query})) AS "similarity"
      FROM message_chunks mc
      JOIN messages m ON m.id = mc.message_id
      JOIN conversations c ON c.id = m.conversation_id
      WHERE ${scope}
        AND to_tsvector('french', mc.content) @@ websearch_to_tsquery('french', ${query})
      ORDER BY "similarity" DESC
      LIMIT ${limit}
    `);
    return rows as unknown as MessageHit[];
  }

  const vecLiteral = `[${queryEmbedding.join(",")}]`;
  const rows = await db.execute(sql`
    WITH q AS (
      SELECT websearch_to_tsquery('french', ${query}) AS tsq, ${vecLiteral}::vector AS vec
    ),
    vec AS (
      SELECT mc.id, 1 - (mc.embedding <=> (SELECT vec FROM q)) AS vec_sim
      FROM message_chunks mc
      JOIN messages m ON m.id = mc.message_id
      JOIN conversations c ON c.id = m.conversation_id
      WHERE ${scope} AND mc.embedding IS NOT NULL
      ORDER BY mc.embedding <=> (SELECT vec FROM q)
      LIMIT ${candidates}
    ),
    kw AS (
      SELECT mc.id, ts_rank(to_tsvector('french', mc.content), (SELECT tsq FROM q)) AS kw_rank
      FROM message_chunks mc
      JOIN messages m ON m.id = mc.message_id
      JOIN conversations c ON c.id = m.conversation_id
      WHERE ${scope} AND to_tsvector('french', mc.content) @@ (SELECT tsq FROM q)
      ORDER BY kw_rank DESC
      LIMIT ${candidates}
    )
    SELECT c.id AS "conversationId", c.title AS "conversationTitle",
           m.role AS "role", mc.content AS "content", m.created_at AS "createdAt",
           (${VECTOR_WEIGHT} * COALESCE(v.vec_sim, 0)
            + ${KEYWORD_WEIGHT} * LEAST(COALESCE(k.kw_rank, 0), 1.0)) AS "similarity"
    FROM message_chunks mc
    JOIN messages m ON m.id = mc.message_id
    JOIN conversations c ON c.id = m.conversation_id
    LEFT JOIN vec v ON v.id = mc.id
    LEFT JOIN kw k ON k.id = mc.id
    WHERE v.id IS NOT NULL OR k.id IS NOT NULL
    ORDER BY "similarity" DESC
    LIMIT ${limit}
  `);
  return rows as unknown as MessageHit[];
}

/**
 * Indexe le contenu d'un message dans message_chunks pour le RAG conversations.
 * Best-effort : sans clé Mistral active, on saute silencieusement (le RAG
 * documents a la même contrainte). Ne lève jamais — l'indexation ne doit pas
 * faire échouer l'enregistrement d'un message.
 */
export async function indexMessageForProject(
  userId: string,
  messageId: string,
  content: string
): Promise<void> {
  const chunks = chunkText(content);
  if (chunks.length === 0) return;
  try {
    const embeddings = await embedTexts(userId, chunks);
    await db.insert(messageChunks).values(
      chunks.map((c, i) => ({
        messageId,
        chunkIndex: i,
        content: c,
        embedding: embeddings[i],
      }))
    );
  } catch (err) {
    if (err instanceof NoEmbeddingProviderError) return;
    // Autres erreurs (réseau, quota embeddings…) : on n'interrompt pas le chat.
  }
}
