import { auth } from "@/auth";

export class PermissionDeniedError extends Error {
  constructor(message = "Permission refusée.") {
    super(message);
    this.name = "PermissionDeniedError";
  }
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
