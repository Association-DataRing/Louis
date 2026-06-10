"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { instanceIsFresh } from "@/lib/setup/status";
import { requireUserId } from "@/lib/auth/permissions";
import { listEnabledModels } from "../(app)/settings/models/actions";

const adminSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.email(),
  password: z.string().min(12).max(200),
});

export type CreateAdminResult = { ok: true } | { ok: false; error: string };

/**
 * Crée le premier compte administrateur de l'instance puis ouvre sa session.
 *
 * Ne fonctionne QUE sur une instance fraîche (zéro utilisateur) : dès qu'un
 * compte existe, l'action est verrouillée — /setup ne peut jamais servir à
 * créer un compte sur une instance déjà installée. La fenêtre de course
 * entre le check et l'insert est couverte par la contrainte UNIQUE sur
 * l'email ; deux inserts concurrents distincts sur une instance vierge ne
 * sont pas un scénario réel (un seul humain installe).
 */
export async function createFirstAdmin(
  _prev: CreateAdminResult | null,
  formData: FormData
): Promise<CreateAdminResult> {
  if (!(await instanceIsFresh())) {
    return { ok: false, error: "Cette instance est déjà installée." };
  }

  const parsed = adminSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error:
        "Vérifiez les champs : le mot de passe doit faire au moins 12 caractères.",
    };
  }

  const { name, email, password } = parsed.data;
  const passwordHash = await bcrypt.hash(password, 12);

  let userId: string;
  try {
    const [created] = await db
      .insert(users)
      .values({ email, name, passwordHash, role: "admin" })
      .returning({ id: users.id });
    userId = created.id;
  } catch {
    return { ok: false, error: "Impossible de créer le compte." };
  }

  await recordAudit({
    userId,
    action: "user.create",
    target: email,
    meta: { via: "setup", role: "admin" },
  });

  // Redirection réelle vers /setup : le navigateur re-requête la page AVEC
  // le cookie de session fraîchement posé, et le wizard reprend à l'étape
  // provider. Un signIn sans redirect ne suffit pas — le re-render déclenché
  // par l'action s'exécute dans la requête courante, dont les cookies ne
  // contiennent pas encore la session, et le garde de /setup renverrait
  // l'utilisateur sur /login en plein milieu du parcours.
  try {
    await signIn("credentials", { email, password, redirectTo: "/setup" });
  } catch (err) {
    if (err instanceof AuthError) {
      return {
        ok: false,
        error: "Compte créé mais connexion impossible. Passez par /login.",
      };
    }
    throw err; // NEXT_REDIRECT : navigation prise en charge par Next.
  }

  return { ok: true };
}

/**
 * Active le catalogue de modèles des providers connectés (auto-seed) et
 * renvoie le nombre de modèles prêts — affiché sur l'écran final du wizard.
 */
export async function activateDefaultModels(): Promise<number> {
  const userId = await requireUserId();
  const models = await listEnabledModels(userId);
  return models.length;
}
