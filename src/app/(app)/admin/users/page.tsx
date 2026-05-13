import { desc } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/permissions";
import { Badge } from "@/components/ui/badge";
import { AddUserDialog } from "./add-user-dialog";
import { UserRow } from "./user-row";

export default async function AdminUsersPage() {
  await requireAdmin();
  const session = await auth();
  const currentId = session!.user.id;

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      isActive: users.isActive,
      lastLogin: users.lastLogin,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt));

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-8 md:px-8 md:py-10">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl tracking-tight">Utilisateurs</h1>
          <p className="mt-2 text-muted-foreground max-w-2xl">
            Créez les comptes des collaborateurs de votre instance. Chaque
            utilisateur reste cloisonné à ses propres providers, connecteurs,
            documents et conversations.
          </p>
        </div>
        <AddUserDialog />
      </header>

      <div className="mb-6 flex items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline">
          {rows.length} utilisateur{rows.length > 1 ? "s" : ""}
        </Badge>
      </div>

      <div className="border border-border rounded-lg divide-y divide-border bg-card">
        {rows.map((u) => (
          <UserRow key={u.id} entry={u} currentUserId={currentId} />
        ))}
      </div>
    </main>
  );
}
