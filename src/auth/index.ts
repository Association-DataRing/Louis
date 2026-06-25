import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { verifyTotp } from "@/lib/totp";
import { rateLimit } from "@/lib/rate-limit";

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

/**
 * Hash bcrypt (coût 12, comme les vrais) d'une valeur factice. On le compare
 * quand l'utilisateur est inconnu/inactif pour que le temps de réponse soit
 * identique à celui d'un compte existant — sinon le retour immédiat (sans
 * bcrypt) permet d'énumérer les comptes valides par timing.
 */
const DUMMY_PASSWORD_HASH =
  "$2b$12$/UhpgtrIsu3oraRqMFfceusRyGfNtEboKmT1qI7fkb2rxNEuITKNK";

/**
 * Première étape du login en deux temps : vérifie l'email + le mot de passe
 * SANS créer de session, et indique si un second facteur (TOTP) est requis.
 *
 * Sert au formulaire multi-étapes (src/app/login) : on ne révèle l'écran
 * « code 2FA » qu'après un mot de passe valide — sinon on divulguerait à un
 * attaquant quels comptes ont la 2FA activée (énumération + ciblage).
 *
 * Le log d'audit d'échec est calqué sur `authorize` ci-dessous : comme un
 * échec à cette étape n'atteint jamais `signIn`/`authorize`, c'est ici qu'il
 * faut tracer la tentative ratée. Le succès, lui, n'est PAS loggé ici (aucune
 * session établie) — il le sera par `authorize` lors du `signIn` final.
 */
export async function verifyPasswordStep(
  email: string,
  password: string
): Promise<{ status: "invalid" } | { status: "ok"; needsTotp: boolean }> {
  const parsed = loginSchema.safeParse({ email, password });
  if (!parsed.success) return { status: "invalid" };

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, parsed.data.email))
    .limit(1);

  if (!user || !user.isActive) {
    // Compare contre un hash factice : même coût CPU qu'un compte réel, pour
    // ne pas révéler par timing si l'email existe.
    await bcrypt.compare(parsed.data.password, DUMMY_PASSWORD_HASH);
    await recordAudit({
      userId: null,
      action: "auth.login.failed",
      target: parsed.data.email,
      meta: { reason: user ? "inactive" : "unknown" },
    });
    return { status: "invalid" };
  }

  const passwordMatch = await bcrypt.compare(
    parsed.data.password,
    user.passwordHash
  );
  if (!passwordMatch) {
    await recordAudit({
      userId: user.id,
      action: "auth.login.failed",
      target: parsed.data.email,
      meta: { reason: "bad_password" },
    });
    return { status: "invalid" };
  }

  return { status: "ok", needsTotp: user.totpEnabled };
}

// Cookies Secure : activés UNIQUEMENT quand l'instance est servie en HTTPS.
// On ne peut PAS se baser sur NODE_ENV : l'image de production tourne aussi
// en http://localhost (install auto-hébergée) ou en HTTP sur un réseau local,
// où un cookie Secure n'est jamais renvoyé par le navigateur (Safari en tête)
// → la session « saute » à chaque navigation et l'utilisateur est renvoyé au
// login. On déduit donc le schéma de l'URL publique déclarée ; défaut =
// non-secure (HTTP). Derrière un reverse proxy TLS, déclarez
// AUTH_URL=https://votre-domaine pour réactiver les cookies Secure.
const publicUrl =
  process.env.AUTH_URL ??
  process.env.NEXTAUTH_URL ??
  process.env.NEXT_PUBLIC_APP_URL ??
  "";
const useSecureCookies = publicUrl.startsWith("https://");

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Indispensable en dev et en self-hosting derrière reverse proxy :
  // sans ça, Auth.js peut rejeter silencieusement des requêtes et
  // retourner une session null intermittente.
  trustHost: true,
  useSecureCookies,
  // Silence les JWTSessionError : c'est l'erreur "no matching decryption
  // secret" qui survient quand un cookie a été chiffré avec une valeur
  // précédente d'AUTH_SECRET. Auth.js gère déjà l'erreur (retourne null
  // pour la session, l'app redirige vers /login, le proxy.ts purge le
  // cookie). Le log d'erreur n'apporte rien — l'utilisateur le voit
  // comme une panne alors que c'est juste un cookie périmé.
  logger: {
    error(error) {
      if (error?.name === "JWTSessionError") return;
      console.error("[auth]", error);
    },
    warn(code) {
      console.warn("[auth][warn]", code);
    },
    debug() {
      // Pas de log debug par défaut.
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 jours
    updateAge: 24 * 60 * 60,   // rotation JWT toutes les 24h
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
        totp: { label: "Code 2FA", type: "text" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        if (!user || !user.isActive) {
          // Timing parity (voir DUMMY_PASSWORD_HASH) — évite l'énumération.
          await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
          // Log failed attempt sans userId (utilisateur inconnu ou désactivé)
          await recordAudit({
            userId: null,
            action: "auth.login.failed",
            target: email,
            meta: { reason: user ? "inactive" : "unknown" },
          });
          return null;
        }

        const passwordMatch = await bcrypt.compare(password, user.passwordHash);
        if (!passwordMatch) {
          await recordAudit({
            userId: user.id,
            action: "auth.login.failed",
            target: email,
            meta: { reason: "bad_password" },
          });
          return null;
        }

        // Second facteur (TOTP) si activé : un code à 6 chiffres OU un code de
        // secours à usage unique (haché). Sans second facteur valide, on rejette.
        if (user.totpEnabled) {
          // Plafond par compte : empêche le brute-force du code à 6 chiffres
          // (le plafond login par IP ne couvre pas un attaquant distribué).
          const rl = await rateLimit("totp", user.id);
          if (!rl.allowed) {
            await recordAudit({
              userId: user.id,
              action: "auth.totp.failed",
              target: email,
              meta: { reason: "rate_limited" },
            });
            return null;
          }
          const rawCredentials = credentials as Record<string, unknown>;
          const code =
            typeof rawCredentials.totp === "string"
              ? rawCredentials.totp.trim()
              : "";
          let totpOk = false;
          if (user.totpSecret && verifyTotp(user.totpSecret, code)) {
            totpOk = true;
          } else if (
            code &&
            Array.isArray(user.backupCodes) &&
            user.backupCodes.length > 0
          ) {
            const normalized = code.toUpperCase().replace(/\s/g, "");
            for (let i = 0; i < user.backupCodes.length; i++) {
              if (await bcrypt.compare(normalized, user.backupCodes[i])) {
                // Code de secours consommé → on le retire (usage unique).
                const remaining = user.backupCodes.filter((_, j) => j !== i);
                await db
                  .update(users)
                  .set({ backupCodes: remaining })
                  .where(eq(users.id, user.id));
                totpOk = true;
                break;
              }
            }
          }
          if (!totpOk) {
            await recordAudit({
              userId: user.id,
              action: "auth.totp.failed",
              target: email,
            });
            return null;
          }
        }

        await db
          .update(users)
          .set({ lastLogin: new Date() })
          .where(eq(users.id, user.id));

        await recordAudit({
          userId: user.id,
          action: "auth.login",
          target: email,
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.avatarUrl,
          role: user.role,
          tokenVersion: user.tokenVersion,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.role = user.role;
        token.tokenVersion = user.tokenVersion ?? 0;
        return token;
      }
      // Sessions existantes : on revalide le compte à CHAQUE accès. Sans ça,
      // désactiver/supprimer un membre (départ de collaborateur) ne coupait son
      // accès qu'au bout des 30 jours du JWT — fenêtre inacceptable pour un
      // système qui détient des données clients privilégiées et les clés de
      // chiffrement at-rest. Lecture PK minimale, donc négligeable. Sur blip DB
      // on garde la session (fail-open dispo) plutôt que de déconnecter tout le
      // cabinet ; la revalidation reprend au prochain accès. Ne tourne qu'en
      // runtime Node (le proxy n'appelle pas auth()), pas en edge.
      if (token.id) {
        try {
          const [u] = await db
            .select({
              isActive: users.isActive,
              role: users.role,
              tokenVersion: users.tokenVersion,
            })
            .from(users)
            .where(eq(users.id, token.id))
            .limit(1);
          if (!u || !u.isActive) return null; // compte supprimé/désactivé → session détruite
          // Invalidation des sessions : un changement de mot de passe ou une
          // désactivation 2FA incrémente tokenVersion → les JWT antérieurs sont
          // rejetés (les tokens émis avant l'ajout de la colonne ont une version
          // absente → comparée à 0, donc préservés, pas de déconnexion massive).
          if ((token.tokenVersion ?? 0) !== u.tokenVersion) return null;
          token.role = u.role; // propage un changement de rôle immédiatement
        } catch {
          // blip DB → on conserve la session existante
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id;
        session.user.role = token.role;
      }
      return session;
    },
  },
});
