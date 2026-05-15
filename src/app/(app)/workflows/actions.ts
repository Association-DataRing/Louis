"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/db";
import { workflows } from "@/db/schema";

export type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

const upsertSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(300).optional(),
  prompt: z.string().trim().min(1).max(4000),
});

export async function createWorkflow(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = upsertSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? undefined,
    prompt: formData.get("prompt"),
  });
  if (!parsed.success) return { ok: false, error: "Champs invalides." };

  const [row] = await db
    .insert(workflows)
    .values({
      userId,
      name: parsed.data.name,
      description: parsed.data.description || null,
      prompt: parsed.data.prompt,
    })
    .returning({ id: workflows.id });

  revalidatePath("/workflows");
  revalidatePath("/chat");
  return { ok: true, id: row.id };
}

export async function updateWorkflow(
  id: string,
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = upsertSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? undefined,
    prompt: formData.get("prompt"),
  });
  if (!parsed.success) return { ok: false, error: "Champs invalides." };

  await db
    .update(workflows)
    .set({
      name: parsed.data.name,
      description: parsed.data.description || null,
      prompt: parsed.data.prompt,
      updatedAt: new Date(),
    })
    .where(and(eq(workflows.id, id), eq(workflows.userId, userId)));

  revalidatePath("/workflows");
  revalidatePath("/chat");
  return { ok: true };
}

export async function deleteWorkflow(id: string): Promise<void> {
  const userId = await requireUserId();
  await db
    .delete(workflows)
    .where(and(eq(workflows.id, id), eq(workflows.userId, userId)));
  revalidatePath("/workflows");
  revalidatePath("/chat");
}

const DEFAULTS = [
  {
    name: "Résumé d'arrêt",
    description: "Synthèse structurée d'une décision de justice.",
    prompt:
      "Résume cet arrêt en 5 sections : 1) Faits matériels et procédure, 2) Prétentions des parties, 3) Motifs retenus par la juridiction, 4) Dispositif, 5) Portée et apports — citations entre guillemets quand utile.",
  },
  {
    name: "Analyse de clause",
    description: "Décortique une clause contractuelle.",
    prompt:
      "Analyse cette clause sur 4 axes : objet de la clause, obligations qu'elle impose, risques (juridiques, opérationnels, financiers), reformulation alternative plus protectrice pour mon client. Cite les passages pertinents.",
  },
  {
    name: "Comparaison de contrats",
    description: "Tableau comparatif sur les dimensions clés.",
    prompt:
      "Compare les contrats fournis sur un tableau avec ces colonnes : objet, durée, prix/honoraires, conditions de résiliation, clause RGPD, juridiction compétente, garanties. Une ligne par contrat.",
  },
  {
    name: "Due diligence rapide",
    description: "Profil juridique d'une entreprise.",
    prompt:
      "Fais une due diligence rapide sur l'entreprise mentionnée : forme juridique, capital, dirigeants, bénéficiaires effectifs, situation financière récente, contentieux connus, risques de réputation. Utilise les connecteurs Pappers/Légifrance si disponibles.",
  },
  {
    name: "Note de synthèse",
    description: "Note interne courte (1 page).",
    prompt:
      "Rédige une note de synthèse interne (max 1 page) en français juridique soutenu : contexte, question de droit, état du droit positif (textes + jurisprudence majeure), réponse argumentée, recommandation pratique. Ton sobre, factuel.",
  },
];

export async function importDefaultWorkflows(): Promise<void> {
  const userId = await requireUserId();
  await db.insert(workflows).values(
    DEFAULTS.map((w) => ({
      userId,
      name: w.name,
      description: w.description,
      prompt: w.prompt,
    }))
  );
  revalidatePath("/workflows");
  revalidatePath("/chat");
}
