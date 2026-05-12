import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { NameForm } from "./name-form";
import { PasswordForm } from "./password-form";

export default async function SettingsPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [user] = await db
    .select({
      email: users.email,
      name: users.name,
      lastLogin: users.lastLogin,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return (
    <main className="px-8 py-10 max-w-3xl">
      <header className="mb-8">
        <h1 className="font-heading text-3xl tracking-tight">Paramètres</h1>
        <p className="mt-2 text-muted-foreground">
          Gérez votre compte et votre mot de passe.
        </p>
      </header>

      <section className="mb-10">
        <h2 className="font-heading text-lg tracking-tight mb-3">Compte</h2>
        <div className="border border-border rounded-lg divide-y divide-border bg-card text-sm">
          <Row label="Email" value={user?.email ?? "—"} mono />
          <Row label="Dernière connexion" value={formatDate(user?.lastLogin)} />
          <Row label="Compte créé le" value={formatDate(user?.createdAt)} />
        </div>
      </section>

      <section className="mb-10">
        <h2 className="font-heading text-lg tracking-tight mb-3">Identité</h2>
        <div className="border border-border rounded-lg bg-card p-5">
          <NameForm initialName={user?.name ?? ""} />
        </div>
      </section>

      <section>
        <h2 className="font-heading text-lg tracking-tight mb-3">
          Mot de passe
        </h2>
        <div className="border border-border rounded-lg bg-card p-5">
          <PasswordForm />
        </div>
      </section>
    </main>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="px-5 py-3 flex items-center gap-4">
      <span className="text-muted-foreground w-48 shrink-0">{label}</span>
      <span className={mono ? "font-mono text-xs" : ""}>{value}</span>
    </div>
  );
}

function formatDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
