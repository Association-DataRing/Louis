import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { pappersSearch, pappersGet } from "./pappers";
import { legifranceSearch } from "./piste";
import { judilibreSearch, judilibreGetDecision } from "./judilibre";
import { bodaccSearch } from "./bodacc";
import { bofipSearch } from "./bofip";
import { listActiveConnectorTypes } from "./runtime";
import { ragSearch } from "@/lib/rag/search";
import { searchProjectMessages } from "@/lib/rag/message-search";
import { NoEmbeddingProviderError } from "@/lib/rag/embed";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { documentChunks, documents, providerKeys } from "@/db/schema";
import { runTool, toolError, toolOk } from "@/lib/tools/result";
import { generateAndStore, storeBuffer } from "@/lib/docgen";
import {
  applyTrackedEdits,
  extractDocxBodyText,
} from "@/lib/docgen/docx-tracked";
import { getObjectBytes } from "@/lib/storage";

/**
 * Périmètre projet (modèle dossier = projet). Quand fourni, les outils
 * documentaires ne voient QUE les documents du projet, les documents
 * générés/édités atterrissent dans son dossier, et l'outil de recherche
 * dans l'historique des conversations du projet est activé.
 */
export type ToolScope = {
  projectId: string;
  /** Conversation courante — exclue de la recherche dans l'historique. */
  conversationId: string;
  /** Documents du projet (sous-arbre du dossier-racine). Peut être vide. */
  documentIds: string[];
  /** Dossier-racine — destination des documents générés/édités. */
  folderId: string | null;
};

/**
 * Build the set of AI SDK tools available for `userId`, based on which
 * connectors they have active. Returns an empty object when no connector
 * is configured — streamText() then runs without tool calling.
 *
 * Quand `scope` est fourni (conversation rattachée à un projet), les outils
 * documentaires sont restreints aux documents du projet — l'IA « ne prend en
 * compte en RAG que les documents du projet ».
 *
 * Tool executions never throw: they return a `{ ok, ... }` envelope so the
 * model can relay a precise error message to the user instead of choking on
 * an opaque "tool execution failed".
 */
export async function buildToolsForUser(
  userId: string,
  scope?: ToolScope
): Promise<ToolSet> {
  const active = await listActiveConnectorTypes(userId);
  const tools: ToolSet = {};

  // Scoping projet : `scoped` distingue le mode projet (documentIds est une
  // liste, éventuellement vide) du mode global (scope absent → tous les docs).
  const scoped = scope != null;
  const scopedDocIds = scope?.documentIds ?? [];
  const scopedDocSet = new Set(scopedDocIds);
  const generatedDocFolderId = scope?.folderId ?? null;

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
    // R9 : comptage SCOPÉ à l'utilisateur (et au projet si scope). Un
    // `$count(documentChunks)` global proposait search_documents à un user
    // sans aucun document dès qu'un AUTRE tenant avait indexé quelque chose
    // (fuite de disponibilité cross-tenant → réponses « aucun résultat »
    // déroutantes). En mode projet sans document, l'outil n'est pas proposé.
    const hasChunks =
      scoped && scopedDocIds.length === 0
        ? []
        : await db
            .select({ documentId: documentChunks.documentId })
            .from(documentChunks)
            .innerJoin(documents, eq(documents.id, documentChunks.documentId))
            .where(
              scoped
                ? and(
                    eq(documents.userId, userId),
                    inArray(documentChunks.documentId, scopedDocIds)
                  )
                : eq(documents.userId, userId)
            )
            .limit(1);
    if (hasChunks.length > 0) {
      tools.search_documents = tool({
        description:
          "Recherche sémantique dans les documents importés par l'utilisateur. Renvoie les passages les plus pertinents avec leur nom de fichier source. Préférez ce tool dès que la question porte sur le contenu d'un document précis, un contrat, un mémo, etc. Échelle de décision : pour le TEXTE EXACT d'un document identifié → read_document ; pour localiser une chaîne précise avant un edit → find_in_document ; si vous ne connaissez pas l'identifiant du document → list_documents d'abord.",
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
            // En contexte projet sans document, on ne retombe PAS sur la
            // recherche globale (ragSearch ignore un documentIds vide) :
            // on renvoie explicitement aucun résultat.
            if (scoped && scopedDocIds.length === 0) return toolOk([]);
            try {
              const hits = await ragSearch(userId, query, {
                documentIds: scoped ? scopedDocIds : undefined,
              });
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

    // Recherche dans l'historique des conversations du projet — disponible
    // dès qu'on est en contexte projet, indépendamment des documents.
    if (scope) {
      const activeScope = scope;
      tools.search_conversation_history = tool({
        description:
          "Recherche sémantique dans l'historique des CONVERSATIONS passées de ce projet (hors conversation courante). Utilisez-le pour retrouver une décision, une analyse ou un échange antérieur avec l'utilisateur sur ce dossier.",
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
              const hits = await searchProjectMessages(
                userId,
                activeScope.projectId,
                query,
                { excludeConversationId: activeScope.conversationId }
              );
              return toolOk(
                hits.map((h) => ({
                  conversation: h.conversationTitle,
                  role: h.role,
                  date: h.createdAt.toISOString().slice(0, 10),
                  content: h.content,
                  similarity: Math.round(h.similarity * 100) / 100,
                }))
              );
            } catch (err) {
              if (err instanceof NoEmbeddingProviderError) {
                return toolError(
                  "config",
                  "La recherche dans l'historique nécessite une clé Mistral active. Activez-la dans /providers."
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
        "Recherche dans Légifrance (codes, lois, décrets, jurisprudence) via la passerelle officielle PISTE. Renvoie jusqu'à 5 résultats avec leur identifiant, titre et URL Légifrance. Utilisez cet outil dès que la question porte sur un article de code, un texte législatif ou une décision officielle. Si 0 résultat, réessayez avec la seule référence d'article (ex. « L. 442-1 ») ou changez `fond` (JURI pour la jurisprudence, CODE_DATE pour les codes consolidés).",
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

    tools.judilibre_search = tool({
      description:
        "Recherche de décisions de justice (Cour de cassation, cours d'appel) via Judilibre / PISTE. Renvoie jusqu'à 5 décisions avec ECLI, chambre, solution, résumé et lien. Utilisez cet outil pour la jurisprudence judiciaire (arrêts, pourvois, QPC). Pour le droit administratif (Conseil d'État), utilisez Légifrance fond JURI.",
      inputSchema: z.object({
        query: z
          .string()
          .min(2)
          .describe("Termes de recherche : mots-clés, n° de pourvoi, thème juridique…"),
        jurisdiction: z
          .enum(["cc", "ca", "tj"])
          .optional()
          .describe("Filtrer par juridiction : cc (Cour de cassation), ca (Cour d'appel), tj (Tribunal judiciaire)."),
        chamber: z
          .string()
          .optional()
          .describe("Filtrer par chambre (ex: 'commerciale', 'sociale', 'criminelle')."),
        date_start: z
          .string()
          .optional()
          .describe("Date début au format YYYY-MM-DD."),
        date_end: z
          .string()
          .optional()
          .describe("Date fin au format YYYY-MM-DD."),
      }),
      execute: async ({ query, jurisdiction, chamber, date_start, date_end }) =>
        judilibreSearch(userId, query, { jurisdiction, chamber, date_start, date_end }),
    });

    tools.judilibre_decision = tool({
      description:
        "Récupère le texte intégral et les métadonnées d'une décision de justice par son identifiant Judilibre. Utilisez cet outil après judilibre_search pour obtenir le contenu complet d'un arrêt.",
      inputSchema: z.object({
        decision_id: z
          .string()
          .min(1)
          .describe("Identifiant Judilibre de la décision (récupéré via judilibre_search)."),
      }),
      execute: async ({ decision_id }) =>
        judilibreGetDecision(userId, decision_id),
    });

    tools.bofip_search = tool({
      description:
        "Recherche dans la doctrine fiscale (BOFIP — Bulletin Officiel des Finances Publiques) via PISTE. Renvoie instructions ministérielles, rescrits, commentaires de l'administration fiscale. Utilisez dès que la question porte sur le régime fiscal, la TVA, l'impôt sur les sociétés, la fiscalité des plus-values, etc.",
      inputSchema: z.object({
        query: z
          .string()
          .min(2)
          .describe("Termes de recherche : thème fiscal, numéro d'instruction, référence BOI…"),
      }),
      execute: async ({ query }) => bofipSearch(userId, query),
    });
  }

  // ─── Sources open data (aucune authentification requise) ────────────────
  // Ces outils sont TOUJOURS disponibles indépendamment des connecteurs
  // configurés par l'utilisateur.

  tools.bodacc_search = tool({
    description:
      "Recherche dans le BODACC (Bulletin Officiel des Annonces Civiles et Commerciales). Couvre créations d'entreprises, modifications, radiations, procédures collectives, ventes/cessions. Aucune configuration requise (données ouvertes). Utile pour la veille commerciale, la due diligence, et les procédures collectives.",
    inputSchema: z.object({
      query: z
        .string()
        .min(2)
        .describe("Nom d'entreprise, numéro d'annonce, ou termes de recherche."),
      departement: z
        .string()
        .optional()
        .describe("Filtrer par département (2 chiffres, ex: '75' pour Paris)."),
      famille: z
        .string()
        .optional()
        .describe("Type d'avis : 'Création', 'Modification', 'Radiation', 'Procédure collective', 'Vente/Cession'."),
      date_start: z
        .string()
        .optional()
        .describe("Date début au format YYYY-MM-DD."),
      date_end: z
        .string()
        .optional()
        .describe("Date fin au format YYYY-MM-DD."),
    }),
    execute: async ({ query, departement, famille, date_start, date_end }) =>
      bodaccSearch(query, { departement, famille, date_start, date_end }),
  });

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
      ordered: z
        .boolean()
        .describe("true = liste numérotée (1. 2. 3.), false = puces."),
      items: z
        .array(z.string().min(1))
        .min(1)
        .describe(
          "Éléments de la liste, un par entrée ; **gras** / _italique_ inline autorisé."
        ),
    }),
    z.object({
      kind: z.literal("blockquote"),
      content: z
        .string()
        .min(1)
        .describe(
          "Citation en retrait — ex. reproduction d'un article de loi ou d'une clause contractuelle."
        ),
    }),
    z.object({
      kind: z.literal("table"),
      headers: z.array(z.string()).min(1).describe("En-têtes de colonnes."),
      rows: z
        .array(z.array(z.string()))
        .min(1)
        .describe(
          "Lignes ; chaque ligne doit comporter autant de cellules que d'en-têtes. Markdown inline autorisé."
        ),
      caption: z
        .string()
        .optional()
        .describe("Légende optionnelle affichée sous le tableau."),
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
      "Génère un document téléchargeable .docx (Word, modifiable) ou .pdf (diffusion finale) à partir d'une structure typée, et l'enregistre dans les documents de l'utilisateur. Utilisez ce tool dès que l'utilisateur demande explicitement un fichier — « rédige une mise en demeure et exporte en docx », « fais-moi un mémo PDF de 3 pages », « génère un tableau comparatif de ces clauses en docx ». Le schéma sections supporte titres (level 1-4), paragraphes (avec alignement justify par défaut, standard juridique), listes ordonnées/à puces, blockquotes, tableaux avec en-têtes, sauts de page (pour pages signature contrat), séparateurs horizontaux. Footer auto avec « Page X / Y ». Le document apparaît automatiquement comme carte cliquable dans le chat (aperçu + bouton télécharger) — vous n'avez PAS besoin d'écrire un lien markdown dans votre réponse, juste de présenter le contenu / les recommandations d'usage.",
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
          "Texte custom à gauche du footer (ex: « Cabinet X · Confidentiel »). La numérotation Page X/Y est ajoutée automatiquement à droite."
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
        // Le modèle produit des listes plates (items = string[]) ; on les
        // convertit au modèle interne ListItem (niveau 0). La numérotation
        // multi-niveaux est réservée au round-trip éditeur (from-prosemirror).
        const normalizedSections = sections.map((s) =>
          s.kind === "list"
            ? { ...s, items: s.items.map((text) => ({ text, level: 0 })) }
            : s
        );
        const result = await generateAndStore({
          format,
          spec: { ...rest, sections: normalizedSections },
          userId,
          folderId: generatedDocFolderId,
        });
        return toolOk({
          document_id: result.documentId,
          filename: result.filename,
          format: result.format,
        });
      }),
  });

  // ───────────────────────────────────────────────────────────────────────
  // Document manipulation tools — opèrent sur les fichiers que
  // l'utilisateur a déjà uploadés via /documents.
  // ───────────────────────────────────────────────────────────────────────

  /**
   * Liste les documents de l'utilisateur — utile au modèle pour résoudre
   * un nom approximatif vers un document_id concret avant edit/read.
   */
  tools.list_documents = tool({
    description:
      "Liste les documents que l'utilisateur a importés (filename + document_id + type + date). Renvoie au plus 50 entrées triées du plus récent au plus ancien. Utilisez ce tool quand l'utilisateur fait référence à un document par son nom et que vous avez besoin de l'ID exact pour read_document, find_in_document, ou edit_document.",
    inputSchema: z.object({}),
    execute: async () =>
      runTool(async () => {
        if (scoped && scopedDocIds.length === 0) return toolOk([]);
        const rows = await db
          .select({
            id: documents.id,
            filename: documents.filename,
            contentType: documents.contentType,
            createdAt: documents.createdAt,
            version: documents.version,
          })
          .from(documents)
          .where(
            scoped
              ? and(
                  eq(documents.userId, userId),
                  inArray(documents.id, scopedDocIds)
                )
              : eq(documents.userId, userId)
          )
          .orderBy(desc(documents.createdAt))
          .limit(50);
        return toolOk(
          rows.map((r) => ({
            document_id: r.id,
            filename: r.filename,
            kind: r.contentType,
            version: r.version,
            uploaded: r.createdAt.toISOString().slice(0, 10),
          }))
        );
      }),
  });

  /**
   * Lit le texte intégral d'un document. Pour les DOCX on relit le ZIP
   * direct (préserve le découpage en paragraphes mieux que mammoth) ; pour
   * les autres on s'appuie sur la colonne extracted_text déjà calculée.
   */
  tools.read_document = tool({
    description:
      "Lit le contenu textuel d'un document de l'utilisateur (PDF, DOCX, texte). Renvoie le texte concaténé, paragraphes séparés par \\n. Utilisez ce tool quand vous avez besoin du texte EXACT (rédaction d'avenant, citation d'article, comparaison clause). Pour une recherche sémantique large, préférez search_documents.",
    inputSchema: z.object({
      document_id: z
        .uuid()
        .describe("UUID du document — récupéré via list_documents."),
      max_chars: z
        .number()
        .int()
        .min(1000)
        .max(200_000)
        .optional()
        .describe("Tronque la sortie. Défaut 80 000."),
    }),
    execute: async ({ document_id, max_chars }) =>
      runTool(async () => {
        if (scoped && !scopedDocSet.has(document_id)) {
          return toolError(
            "validation",
            "Ce document n'appartient pas au projet courant."
          );
        }
        const [doc] = await db
          .select({
            id: documents.id,
            filename: documents.filename,
            contentType: documents.contentType,
            storageKey: documents.storageKey,
            extractedText: documents.extractedText,
          })
          .from(documents)
          .where(
            and(
              eq(documents.id, document_id),
              eq(documents.userId, userId)
            )
          )
          .limit(1);
        if (!doc) {
          return toolError("validation", "Document introuvable.");
        }
        // Préfère un re-extract direct du DOCX si dispo (paragraphes
        // proprement séparés). Sinon retombe sur extracted_text.
        let text = doc.extractedText ?? "";
        if (
          doc.contentType ===
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ) {
          try {
            const bytes = Buffer.from(await getObjectBytes(doc.storageKey));
            const fresh = await extractDocxBodyText(bytes);
            if (fresh.length > 0) text = fresh;
          } catch {
            // fallback silently
          }
        }
        const cap = max_chars ?? 80_000;
        const truncated = text.length > cap;
        return toolOk({
          document_id: doc.id,
          filename: doc.filename,
          text: text.slice(0, cap),
          chars: text.length,
          truncated,
        });
      }),
  });

  /**
   * Recherche par sous-chaîne exacte dans un document. Complète
   * search_documents (qui est sémantique et top-k) quand le modèle a besoin
   * de localiser une formulation précise pour préparer un edit.
   */
  tools.find_in_document = tool({
    description:
      "Cherche une chaîne exacte dans un document de l'utilisateur. Renvoie jusqu'à 10 occurrences avec un contexte de ±60 caractères. Utilisez ce tool en préparation d'un edit_document pour vérifier que le texte cible existe et collecter le bon context_before / context_after.",
    inputSchema: z.object({
      document_id: z.uuid(),
      needle: z.string().min(2).describe("Chaîne exacte à chercher."),
    }),
    execute: async ({ document_id, needle }) =>
      runTool(async () => {
        if (scoped && !scopedDocSet.has(document_id)) {
          return toolError(
            "validation",
            "Ce document n'appartient pas au projet courant."
          );
        }
        const [doc] = await db
          .select({
            extractedText: documents.extractedText,
            contentType: documents.contentType,
            storageKey: documents.storageKey,
            filename: documents.filename,
          })
          .from(documents)
          .where(
            and(eq(documents.id, document_id), eq(documents.userId, userId))
          )
          .limit(1);
        if (!doc) return toolError("validation", "Document introuvable.");
        let text = doc.extractedText ?? "";
        if (
          doc.contentType ===
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ) {
          try {
            const bytes = Buffer.from(await getObjectBytes(doc.storageKey));
            const fresh = await extractDocxBodyText(bytes);
            if (fresh.length > 0) text = fresh;
          } catch {}
        }
        const occurrences: Array<{
          char_offset: number;
          context_before: string;
          match: string;
          context_after: string;
        }> = [];
        let from = 0;
        while (occurrences.length < 10) {
          const at = text.indexOf(needle, from);
          if (at < 0) break;
          occurrences.push({
            char_offset: at,
            context_before: text.slice(Math.max(0, at - 60), at),
            match: needle,
            context_after: text.slice(at + needle.length, at + needle.length + 60),
          });
          from = at + needle.length;
        }
        return toolOk({
          filename: doc.filename,
          total_chars: text.length,
          occurrences,
        });
      }),
  });

  /**
   * Killer feature : applique une liste d'éditions comme tracked changes
   * Word natifs sur un DOCX uploadé. Renvoie le nouveau DOCX en
   * téléchargement + un rapport applied/errors. Le modèle peut ensuite
   * proposer Accept/Reject à l'utilisateur — qui peut aussi le faire
   * directement dans Word via l'onglet Révision.
   */
  tools.edit_document = tool({
    description:
      "Propose des éditions sur un fichier .docx de l'utilisateur en TRACKED CHANGES Word natifs (insertions/suppressions visibles dans l'onglet Révision de Word/Pages/LibreOffice). Chaque édit est une substitution précise — gardez `find` aussi court que possible (les mots/caractères réellement modifiés, pas un paragraphe entier) et fournissez context_before/context_after (~40 caractères) pour ancrer le match sans ambiguïté. Utilisez read_document ou find_in_document avant pour vérifier le texte exact. Le document édité apparaît comme carte cliquable dans le chat (aperçu + bouton télécharger), avec le détail des édits appliqués / en erreur — pas besoin de lien markdown.",
    inputSchema: z.object({
      document_id: z
        .uuid()
        .describe("UUID du DOCX à éditer (autres formats refusés)."),
      edits: z
        .array(
          z.object({
            find: z.string().min(1).describe("Chaîne exacte à remplacer."),
            replace: z
              .string()
              .describe(
                "Chaîne de remplacement. Vide = pure suppression."
              ),
            context_before: z
              .string()
              .max(120)
              .optional()
              .describe(
                "~40 caractères qui précèdent immédiatement `find`, pour disambiguïsation."
              ),
            context_after: z.string().max(120).optional(),
            reason: z
              .string()
              .max(200)
              .optional()
              .describe(
                "Explication courte montrée à l'utilisateur sur la carte d'édit."
              ),
          })
        )
        .min(1)
        .max(50),
    }),
    execute: async ({ document_id, edits }) =>
      runTool(async () => {
        if (scoped && !scopedDocSet.has(document_id)) {
          return toolError(
            "validation",
            "Ce document n'appartient pas au projet courant."
          );
        }
        const [doc] = await db
          .select({
            id: documents.id,
            filename: documents.filename,
            contentType: documents.contentType,
            storageKey: documents.storageKey,
          })
          .from(documents)
          .where(
            and(eq(documents.id, document_id), eq(documents.userId, userId))
          )
          .limit(1);
        if (!doc) return toolError("validation", "Document introuvable.");
        if (
          doc.contentType !==
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ) {
          return toolError(
            "validation",
            "Seuls les fichiers .docx peuvent être édités en tracked changes."
          );
        }

        const bytes = Buffer.from(await getObjectBytes(doc.storageKey));
        const result = await applyTrackedEdits(bytes, edits, {
          author: "Louis",
        });

        const baseName = doc.filename.replace(/\.docx$/i, "");
        const stored = await storeBuffer({
          buffer: result.buffer,
          contentType:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          filename: `${baseName} (édité par Louis).docx`,
          userId,
          folderId: generatedDocFolderId,
        });

        return toolOk({
          document_id: stored.documentId,
          filename: stored.filename,
          format: "docx" as const,
          applied_count: result.applied.length,
          errors_count: result.errors.length,
          applied: result.applied,
          errors: result.errors,
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
