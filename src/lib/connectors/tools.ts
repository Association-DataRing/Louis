import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { pappersSearch, pappersGet } from "./pappers";
import { listActiveConnectorTypes } from "./runtime";

/**
 * Build the set of AI SDK tools available for `userId`, based on which
 * connectors they have active. Returns an empty object when no connector
 * is configured — streamText() then runs without tool calling.
 */
export async function buildToolsForUser(userId: string): Promise<ToolSet> {
  const active = await listActiveConnectorTypes(userId);
  const tools: ToolSet = {};

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
      execute: async ({ query }) => {
        return pappersSearch(userId, query);
      },
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
      execute: async ({ siren }) => {
        return pappersGet(userId, siren);
      },
    });
  }

  return tools;
}
