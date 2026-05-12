import { auth } from "@/auth";
import type { UserRole } from "@/db/schema/users";

export class PermissionDeniedError extends Error {
  constructor(message = "Permission refusée.") {
    super(message);
    this.name = "PermissionDeniedError";
  }
}

export async function requireRole(role: UserRole): Promise<{
  userId: string;
  role: UserRole;
}> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new PermissionDeniedError("Vous devez être connecté.");
  }
  if (session.user.role !== role && session.user.role !== "admin") {
    throw new PermissionDeniedError();
  }
  return { userId: session.user.id, role: session.user.role };
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
