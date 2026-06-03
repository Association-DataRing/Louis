-- Recherche hybride vecteur + mot-clé (rag/search.ts, rag/message-search.ts).
-- Index GIN d'EXPRESSION sur to_tsvector('french', content) : permet le rappel
-- des tokens exacts (n° d'article, n° de pourvoi, nom de partie, terme défini)
-- que la recherche purement vectorielle manque. Sert aussi de repli mot-clé
-- quand aucun backend d'embedding n'est disponible (déploiement air-gapped).

CREATE INDEX IF NOT EXISTS "document_chunks_fts_idx"
  ON "document_chunks" USING gin (to_tsvector('french', "content"));

CREATE INDEX IF NOT EXISTS "message_chunks_fts_idx"
  ON "message_chunks" USING gin (to_tsvector('french', "content"));
