/**
 * Ensemencement de premier lancement — exécuté par l'installeur TUI DANS le
 * réseau du compose (image « migrate »), la base n'étant pas joignable depuis
 * l'hôte. Crée le compte administrateur et, si fournie, une clé provider
 * chiffrée (marquée par défaut), en miroir de /setup et de
 * createProviderKeyTested.
 *
 * Idempotent & sûr : n'agit QUE sur une instance fraîche (zéro utilisateur).
 * Dès qu'un compte existe, le script sort sans rien modifier — relancer
 * l'installeur ne peut jamais écraser un admin existant.
 *
 * Variables attendues (injectées via --env-from-file par l'installeur) :
 *   ENCRYPTION_KEY            (déjà présent dans l'environnement du conteneur)
 *   SEED_ADMIN_NAME, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD
 * Optionnelles (clé provider) :
 *   SEED_PROVIDER_TYPE, SEED_PROVIDER_LABEL, SEED_PROVIDER_API_KEY,
 *   SEED_PROVIDER_BASE_URL, SEED_PROVIDER_TEST_STATUS
 *
 * Imports RELATIFS uniquement (pas d'alias @/) : sous tsx, seuls les
 * `import type` alias sont élidés — les imports de valeur doivent être relatifs.
 */
import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";
import { db } from "../src/db";
import { users, providerKeys } from "../src/db/schema";
import { encrypt } from "../src/lib/crypto";

const PROVIDER_TYPES = [
  "mistral",
  "scaleway",
  "ovh",
  "albert",
  "anthropic",
  "openai",
  "openai_compatible",
  "openrouter",
] as const;

type ProviderType = (typeof PROVIDER_TYPES)[number];

function req(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) {
    console.error(`seed-setup: ${name} manquant.`);
    process.exit(1);
  }
  return v;
}

async function main() {
  // Email stocké VERBATIM (trim uniquement) : c'est exactement ce que fait
  // createFirstAdmin (/setup) et la comparaison au login (eq sur users.email
  // sans normalisation). Le mettre en minuscules ici casserait la connexion
  // si l'admin a saisi une majuscule.
  const email = req("SEED_ADMIN_EMAIL").trim();
  const password = req("SEED_ADMIN_PASSWORD");
  const name = (process.env.SEED_ADMIN_NAME || "Admin").trim();

  if (password.length < 12) {
    console.error("seed-setup: SEED_ADMIN_PASSWORD doit faire au moins 12 caractères.");
    process.exit(1);
  }

  // Instance fraîche uniquement : jamais écraser un déploiement déjà installé.
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(users)
    .limit(1);
  if ((row?.n ?? 0) !== 0) {
    console.log("seed-setup: instance déjà installée — aucune modification.");
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const [admin] = await db
    .insert(users)
    .values({ email, name, passwordHash, role: "admin" })
    .returning({ id: users.id });
  console.log(`seed-setup: administrateur créé (${email}).`);

  // Clé provider optionnelle — chiffrée avec ENCRYPTION_KEY, marquée par défaut.
  const providerType = process.env.SEED_PROVIDER_TYPE?.trim();
  const providerKey = process.env.SEED_PROVIDER_API_KEY;
  if (providerType && providerKey) {
    if (!PROVIDER_TYPES.includes(providerType as ProviderType)) {
      console.error(`seed-setup: provider inconnu (${providerType}) — clé ignorée.`);
      process.exit(0);
    }
    const label = (process.env.SEED_PROVIDER_LABEL || providerType).trim();
    const baseUrl = process.env.SEED_PROVIDER_BASE_URL?.trim() || null;
    const testStatus = process.env.SEED_PROVIDER_TEST_STATUS?.trim() || null;

    const blob = encrypt(providerKey);
    await db.insert(providerKeys).values({
      userId: admin.id,
      type: providerType as ProviderType,
      label,
      apiKeyCiphertext: blob.ciphertext,
      apiKeyIv: blob.iv,
      apiKeyTag: blob.tag,
      baseUrl,
      isDefault: true,
      lastTestedAt: new Date(),
      lastTestStatus: testStatus,
    });
    console.log(`seed-setup: clé provider ${providerType} enregistrée (par défaut).`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("seed-setup:", err);
  process.exit(1);
});
