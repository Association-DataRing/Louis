import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { recordAudit } from "@/lib/audit";

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
