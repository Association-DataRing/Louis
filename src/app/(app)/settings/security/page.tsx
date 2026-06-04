import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { TwoFactorSetup } from "./two-factor-setup";

export default async function SecurityPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const [user] = await db
    .select({ totpEnabled: users.totpEnabled })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-8 md:px-8 md:py-10">
      <header className="mb-8 max-w-2xl">
        <p className="text-xs text-foreground/70 uppercase tracking-wider">
          Compte
        </p>
        <h1 className="mt-1 font-heading text-3xl tracking-tight">Sécurité</h1>
        <p className="mt-2 text-muted-foreground text-sm">
          Protégez l&apos;accès à votre compte.
        </p>
      </header>
      <div className="max-w-2xl">
        <TwoFactorSetup enabled={user?.totpEnabled ?? false} />
      </div>
    </main>
  );
}
