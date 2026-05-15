import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { pappersSearch, pappersGet } from "./pappers";
import { legifranceSearch } from "./piste";
import { listActiveConnectorTypes } from "./runtime";
import { ragSearch } from "@/lib/rag/search";
import { NoEmbeddingProviderError } from "@/lib/rag/embed";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { documentChunks, providerKeys } from "@/db/schema";
import { runTool, toolError, toolOk } from "@/lib/tools/result";
import { generateAndStore } from "@/lib/docgen";

/**
 * Build the set of AI SDK tools available for `userId`, based on which
 * connectors they have active. Returns an empty object when no connector
 * is configured — streamText() then runs without tool calling.
 *
 * Tool executions never throw: they return a `{ ok, ... }` envelope so the
 * model can relay a precise error message to the user instead of choking on
 * an opaque "tool execution failed".
 */
export async function buildToolsForUser(userId: string): Promise<ToolSet> {
  const active = await listActiveConnectorTypes(userId);
  const tools: ToolSet = {};

  // search_documents : disponible si l'utilisateur a au moins un chunk
  // indexé ET une clé Mistral active (requise pour embedder la requête).
  const hasMistral = await db
    .select({ id: providerKeys.id })
    .from(providerKeys)
    .where(
      and(
        eq(providerKeys.userId, userId),
        eq(providerKeys.type, "mistral"),
        eq(providerKeys.isActive, true)
      )
    )
    .limit(1);

  if (hasMistral.length > 0) {
    const chunkCount = await db.$count(documentChunks);
    if (chunkCount > 0) {
      tools.search_documents = tool({
        description:
          "Recherche sémantique dans les documents importés par l'utilisateur. Renvoie les passages les plus pertinents avec leur nom de fichier source. Préférez ce tool dès que la question porte sur le contenu d'un document précis, un contrat, un mémo, etc.",
        inputSchema: z.object({
          query: z
            .string()
            .min(2)
            .describe(
              "Question ou termes-clés. Sera traduite en embedding vectoriel."
            ),
        }),
        execute: async ({ query }) =>
          runTool(async () => {
            try {
              const hits = await ragSearch(userId, query);
              return toolOk(
                hits.map((h) => ({
                  filename: h.filename,
                  chunk: h.chunkIndex,
                  content: h.content,
                  similarity: Math.round(h.similarity * 100) / 100,
                }))
              );
            } catch (err) {
              if (err instanceof NoEmbeddingProviderError) {
                return toolError(
                  "config",
                  "La recherche documentaire nécessite une clé Mistral active. Activez-la dans /providers."
                );
              }
              throw err;
            }
          }),
      });
    }
  }

  if (active.includes("piste")) {
    tools.legifrance_search = tool({
      description:
        "Recherche dans Légifrance (codes, lois, décrets, jurisprudence) via la passerelle officielle PISTE. Renvoie jusqu'à 5 résultats avec leur identifiant, titre et URL Légifrance. Utilisez cet outil dès que la question porte sur un article de code, un texte législatif ou une décision officielle.",
      inputSchema: z.object({
        query: z
          .string()
          .min(2)
          .describe(
            "Termes de recherche en français : numéro d'article + intitulé, mots-clés juridiques, nom d'une décision…"
          ),
        fond: z
          .enum(["ALL", "CODE_DATE", "JURI"])
          .optional()
          .describe(
            "Domaine de recherche : ALL (tout), CODE_DATE (codes consolidés), JURI (jurisprudence). Par défaut ALL."
          ),
      }),
      execute: async ({ query, fond }) =>
        legifranceSearch(userId, query, fond ?? "ALL"),
    });
  }

  // Génération de documents — toujours disponible, indépendant de tout
  // connecteur externe. Utilise des libs pure-JS côté serveur Louis.
  tools.generate_document = tool({
    description:
      "Génère un document téléchargeable au format DOCX (Word) ou PDF à partir d'un titre et d'un contenu Markdown. Utilisez ce tool dès que l'utilisateur demande explicitement un fichier .docx ou .pdf — par exemple « rédige une mise en demeure et exporte en docx », « fais-moi un mémo PDF »… Renvoie une URL de téléchargement valable 10 minutes. Présentez ensuite le lien à l'utilisateur sous forme cliquable en Markdown standard, par exemple : « [Télécharger le document](URL) ».",
    inputSchema: z.object({
      format: z
        .enum(["docx", "pdf"])
        .describe(
          "Format du document. docx pour Word/Pages (modifiable), pdf pour la diffusion finale."
        ),
      title: z
        .string()
        .min(1)
        .max(200)
        .describe(
          "Titre du document, affiché en grand en première page et utilisé comme nom de fichier."
        ),
      content_markdown: z
        .string()
        .min(1)
        .describe(
          "Corps du document en Markdown — # ## ### pour les titres, **gras** _italique_, listes -/1., > blockquote, --- pour séparateur. Pas de tables ni de code fences. Utilisez du français impeccable, pas de phrases bâteau."
        ),
    }),
    execute: async ({ format, title, content_markdown }) =>
      runTool(async () => {
        const { url, filename } = await generateAndStore({
          format,
          title,
          contentMarkdown: content_markdown,
          userId,
        });
        return toolOk({
          url,
          filename,
          format,
          ttl_minutes: 10,
        });
      }),
  });

  if (active.includes("pappers")) {
    tools.pappers_search = tool({
      description:
        "Recherche une entreprise française par nom ou raison sociale dans la base Pappers. Renvoie jusqu'à 5 résultats avec SIREN, forme juridique, ville. Utile quand l'utilisateur cite un nom d'entreprise sans donner de SIREN.",
      inputSchema: z.object({
        query: z
          .string()
          .min(2)
          .describe("Nom ou raison sociale de l'entreprise à rechercher"),
      }),
      execute: async ({ query }) => pappersSearch(userId, query),
    });

    tools.pappers_get = tool({
      description:
        "Récupère les informations détaillées d'une entreprise française (siège, capital, dirigeants, code APE) à partir de son SIREN (9 chiffres). Préférez ce tool à pappers_search dès que vous avez le SIREN.",
      inputSchema: z.object({
        siren: z
          .string()
          .regex(/^\d{9}$/, "Le SIREN doit faire exactement 9 chiffres")
          .describe("Numéro SIREN à 9 chiffres"),
      }),
      execute: async ({ siren }) => pappersGet(userId, siren),
    });
  }

  return tools;
}
