import { auth } from "@/auth";

export class PermissionDeniedError extends Error {
  constructor(message = "Permission refusée.") {
    super(message);
    this.name = "PermissionDeniedError";
  }
}

/**
 * Renvoie l'id de l'utilisateur connecté, ou lève si la session est absente.
 * Helper partagé par toutes les server actions (auparavant redéfini à
 * l'identique dans chaque fichier `actions.ts`).
 */
export async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

export async function requireAdmin(): Promise<{ userId: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new PermissionDeniedError("Vous devez être connecté.");
  }
  if (session.user.role !== "admin") {
    throw new PermissionDeniedError("Réservé aux administrateurs.");
  }
  return { userId: session.user.id };
}
