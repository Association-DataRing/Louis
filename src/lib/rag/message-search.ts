import { and, cosineDistance, desc, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { messageChunks, messages, conversations } from "@/db/schema";
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

/**
 * Recherche vectorielle dans l'historique des conversations d'un projet.
 * Jointure message_chunks → messages → conversations pour ne garder que les
 * conversations de l'utilisateur rattachées au projet. La conversation
 * courante peut être exclue (son contenu est déjà dans le contexte du modèle).
 */
export async function searchProjectMessages(
  userId: string,
  projectId: string,
  query: string,
  options?: { excludeConversationId?: string | null; limit?: number }
): Promise<MessageHit[]> {
  const limit = options?.limit ?? 6;
  const queryEmbedding = await embedQuery(userId, query);

  const similarity = sql<number>`1 - (${cosineDistance(
    messageChunks.embedding,
    queryEmbedding
  )})`;

  const conds = [
    eq(conversations.userId, userId),
    eq(conversations.projectId, projectId),
  ];
  if (options?.excludeConversationId) {
    conds.push(ne(conversations.id, options.excludeConversationId));
  }

  const rows = await db
    .select({
      conversationId: conversations.id,
      conversationTitle: conversations.title,
      role: messages.role,
      content: messageChunks.content,
      createdAt: messages.createdAt,
      similarity,
    })
    .from(messageChunks)
    .innerJoin(messages, eq(messages.id, messageChunks.messageId))
    .innerJoin(conversations, eq(conversations.id, messages.conversationId))
    .where(and(...conds))
    .orderBy(desc(similarity))
    .limit(limit);

  return rows;
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
