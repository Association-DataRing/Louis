import { eq } from "drizzle-orm";
import { IconShieldLock } from "@tabler/icons-react";
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
    <div className="max-w-2xl">
      <div className="flex items-center gap-2 mb-1">
        <IconShieldLock className="size-5" />
        <h1 className="text-lg font-semibold">Sécurité</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Protégez l&apos;accès à votre compte.
      </p>
      <TwoFactorSetup enabled={user?.totpEnabled ?? false} />
    </div>
  );
}
