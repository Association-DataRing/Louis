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

  // Génération de documents — toujours disponible, indépendant des
  // connecteurs externes. Pure-JS côté serveur Louis (docx + pdfkit), pas
  // de dépendance LibreOffice ni d'envoi vers un service tiers.
  const sectionSchema = z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("heading"),
      level: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
      text: z.string().min(1),
      align: z.enum(["left", "center", "right", "justify"]).optional(),
    }),
    z.object({
      kind: z.literal("paragraph"),
      content: z
        .string()
        .min(1)
        .describe(
          "Texte du paragraphe. Peut contenir **gras** et _italique_ inline. Pas de \\n internes — utilisez plusieurs sections paragraph pour les sauts."
        ),
      align: z.enum(["left", "center", "right", "justify"]).optional(),
      bold: z.boolean().optional(),
      italic: z.boolean().optional(),
    }),
    z.object({
      kind: z.literal("list"),
      ordered: z.boolean(),
      items: z.array(z.string().min(1)).min(1),
    }),
    z.object({
      kind: z.literal("blockquote"),
      content: z.string().min(1),
    }),
    z.object({
      kind: z.literal("table"),
      headers: z.array(z.string()).min(1),
      rows: z.array(z.array(z.string())).min(1),
      caption: z.string().optional(),
    }),
    z.object({
      kind: z.literal("pageBreak"),
    }),
    z.object({
      kind: z.literal("hr"),
    }),
    z.object({
      kind: z.literal("spacer"),
      lines: z.number().int().min(1).max(10).optional(),
    }),
  ]);

  tools.generate_document = tool({
    description:
      "Génère un document téléchargeable .docx (Word, modifiable) ou .pdf (diffusion finale) à partir d'une structure typée. Utilisez ce tool dès que l'utilisateur demande explicitement un fichier — « rédige une mise en demeure et exporte en docx », « fais-moi un mémo PDF de 3 pages », « génère un tableau comparatif de ces clauses en docx ». Le schéma sections supporte titres (level 1-4), paragraphes (avec alignement justify par défaut, standard juridique), listes ordonnées/à puces, blockquotes, tableaux avec en-têtes, sauts de page (pour pages signature contrat), séparateurs horizontaux. Footer auto avec « Page X / Y ». Renvoie une URL valable 10 minutes — présentez-la à l'utilisateur sous forme « [Télécharger le document](URL) ».",
    inputSchema: z.object({
      format: z
        .enum(["docx", "pdf"])
        .describe("docx : modifiable dans Word/Pages. pdf : version finale."),
      title: z.string().min(1).max(200),
      subtitle: z
        .string()
        .max(200)
        .optional()
        .describe(
          "Sous-titre optionnel sous le titre principal (ex: référence dossier, date)."
        ),
      footer: z
        .string()
        .max(120)
        .optional()
        .describe(
          "Texte custom à gauche du footer (ex: « Cabinet Altij · Confidentiel »). La numérotation Page X/Y est ajoutée automatiquement à droite."
        ),
      pageNumbers: z
        .boolean()
        .optional()
        .describe("Afficher Page X/Y. Défaut true."),
      landscape: z
        .boolean()
        .optional()
        .describe(
          "Orientation paysage. Utile pour les tableaux larges. Défaut portrait."
        ),
      fontFamily: z
        .enum(["serif", "sans"])
        .optional()
        .describe(
          "serif (Cambria/Times) pour ton juridique classique, sans (Calibri/Helvetica) pour ton moderne. Défaut serif."
        ),
      sections: z
        .array(sectionSchema)
        .min(1)
        .describe(
          "Liste ordonnée de sections typées. Construisez le document section par section."
        ),
    }),
    execute: async ({ format, sections, ...rest }) =>
      runTool(async () => {
        const result = await generateAndStore({
          format,
          spec: { ...rest, sections },
          userId,
        });
        return toolOk({
          ...result,
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
