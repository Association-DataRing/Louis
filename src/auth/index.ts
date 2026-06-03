import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { verifyTotp } from "@/lib/totp";

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

// En dev on tourne sur http://localhost — donc PAS de cookie Secure
// (sinon le navigateur ne le renvoie pas et l'utilisateur est
// déconnecté à chaque retour de tab). En prod, Auth.js bascule via la
// détection auto (X-Forwarded-Proto: https).
const isProd = process.env.NODE_ENV === "production";

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Indispensable en dev et en self-hosting derrière reverse proxy :
  // sans ça, Auth.js peut rejeter silencieusement des requêtes et
  // retourner une session null intermittente.
  trustHost: true,
  // Force le cookie non-Secure en dev pour qu'il fonctionne en HTTP.
  useSecureCookies: isProd,
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
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.role = user.role;
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
            .select({ isActive: users.isActive, role: users.role })
            .from(users)
            .where(eq(users.id, token.id))
            .limit(1);
          if (!u || !u.isActive) return null; // compte supprimé/désactivé → session détruite
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
