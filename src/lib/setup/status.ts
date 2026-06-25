import { sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

/**
 * Une instance est « fraîche » tant qu'aucun utilisateur n'existe : c'est le
 * signal qui déclenche l'assistant de premier lancement (/setup) à la place
 * de l'écran de connexion. Dès le premier admin créé, /setup se verrouille
 * définitivement.
 */
export async function instanceIsFresh(): Promise<boolean> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(users)
    .limit(1);
  return (row?.n ?? 0) === 0;
}
