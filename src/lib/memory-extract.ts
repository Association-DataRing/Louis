import { generateObject } from "ai";
import { z } from "zod";
import type { LanguageModel } from "ai";
import { db } from "@/db";
import { projectMemories, MEMORY_CATEGORIES } from "@/db/schema";

const schema = z.object({
  memories: z
    .array(
      z.object({
        category: z.enum(MEMORY_CATEGORIES),
        text: z
          .string()
          .min(3)
          .max(280)
          .describe("Le fait, formulé de façon autonome et concise."),
      })
    )
    .max(5),
});

const SYSTEM = `Tu extrais des FAITS DURABLES et utiles d'un échange juridique, pour la mémoire d'un DOSSIER. N'extrais QUE ce qui restera vrai et utile au-delà de cet échange : parties et leurs rôles (party), échéances/délais (deadline), conventions de rédaction du cabinet (convention), faits du dossier (fact), préférences de l'utilisateur (preference). N'invente rien, ne déduis pas. Si rien de durable ne ressort, renvoie une liste vide. Sois très sobre : préfère 0 à 5 faits, jamais de bavardage.`;

/** Extraction désactivée par défaut (coût d'un appel LLM par tour de dossier). */
export function memoryExtractionEnabled(): boolean {
  const v = process.env.LOUIS_MEMORY_EXTRACTION;
  return v === "1" || v === "true";
}

/**
 * Extrait des faits durables de l'échange et les stocke en statut « pending »
 * (jamais utilisés tant qu'un humain ne les a pas validés). Best-effort : ne
 * lève jamais — l'extraction ne doit pas perturber le chat.
 */
export async function extractAndStoreMemories(args: {
  model: LanguageModel;
  userId: string;
  projectId: string;
  sourceMessageId: string | null;
  userText: string;
  assistantText: string;
}): Promise<void> {
  const { model, userId, projectId, sourceMessageId, userText, assistantText } =
    args;
  try {
    const { object } = await generateObject({
      model,
      schema,
      system: SYSTEM,
      prompt: `Demande de l'utilisateur :\n"""\n${userText}\n"""\n\nRéponse de l'assistant :\n"""\n${assistantText}\n"""\n\nQuels faits durables retenir pour la mémoire du dossier ?`,
      maxRetries: 1,
    });
    if (object.memories.length === 0) return;
    await db.insert(projectMemories).values(
      object.memories.map((m) => ({
        userId,
        projectId,
        category: m.category,
        text: m.text,
        sourceMessageId,
        status: "pending" as const,
      }))
    );
  } catch {
    // best-effort : extraction silencieuse
  }
}
