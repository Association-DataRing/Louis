import { NextResponse, type NextRequest } from "next/server";

/**
 * Proxy Next.js 16 (anciennement middleware.ts) — deux responsabilités :
 *
 *  1. Headers de sécurité HTTP sur toutes les réponses (CSP, HSTS,
 *     anti-clickjacking, anti-MIME-sniffing, referrer policy,
 *     permissions policy).
 *
 *  2. Nettoyage des cookies Auth.js sur /login. Quand l'utilisateur a un
 *     cookie de session corrompu (chiffré avec un AUTH_SECRET précédent,
 *     ce qui arrive si la valeur a changé), Auth.js log
 *     "JWTSessionError: no matching decryption secret" à CHAQUE requête
 *     sans jamais supprimer le cookie côté serveur. Résultat : boucle
 *     infinie /login → tentative de connexion → /login.
 *     Un Server Component n'a pas le droit de muter les cookies pendant
 *     le rendering (Next 16 : "Cookies can only be modified in a Server
 *     Action or Route Handler"). Le proxy est l'endroit prévu pour ça.
 *
 * La CSP est volontairement permissive sur les scripts inline en v0.1 —
 * Next injecte des scripts d'hydration inline et React Compiler génère
 * du code inline. Durcissement strict-dynamic + nonces prévu en v0.1.x.
 *
 * Le matcher exclut les assets statiques (next/static, next/image,
 * favicon) pour éviter d'inonder les binaires de headers HTML-spécifiques.
 */

const isProd = process.env.NODE_ENV === "production";

const AUTHJS_COOKIE_NAMES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
  "authjs.csrf-token",
  "__Host-authjs.csrf-token",
  "authjs.callback-url",
  "__Secure-authjs.callback-url",
];

const CSP = [
  "default-src 'self'",
  // 'unsafe-inline' nécessaire pour Next/React hydration. À durcir
  // Phase 3+ via nonces.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  // Tailwind v4 + shadcn génèrent du CSS inline pour les variables,
  // garder 'unsafe-inline' sur les styles.
  "style-src 'self' 'unsafe-inline'",
  // EB Garamond / Geist viennent de next/font (servis depuis 'self').
  "font-src 'self' data:",
  // Documents uploadés + previews PDF (blob:) + favicon.svg
  "img-src 'self' data: blob:",
  // Streaming chat + appels providers via API routes (donc 'self').
  "connect-src 'self'",
  // Anti-clickjacking, équivalent moderne à X-Frame-Options DENY
  "frame-ancestors 'none'",
  // Empêche un attaquant de poster un form vers un domaine externe
  "form-action 'self'",
  // Bloque les <base> qui détourneraient les liens relatifs
  "base-uri 'self'",
  // Aucun plugin / Flash / Java
  "object-src 'none'",
].join("; ");

export function proxy(req: NextRequest) {
  const res = NextResponse.next();

  // (1) Headers de sécurité
  res.headers.set("Content-Security-Policy", CSP);
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=()"
  );
  // X-Frame-Options en complément de frame-ancestors pour les vieux clients
  res.headers.set("X-Frame-Options", "DENY");

  // HSTS : 1 an, sub-domains, preload. UNIQUEMENT en prod (en dev on
  // tape http://localhost et un HSTS leaké casserait le dev local).
  if (isProd) {
    res.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload"
    );
  }

  // (2) Purge des cookies authjs.* à l'atterrissage sur /login.
  // L'utilisateur arrive sur /login uniquement s'il n'est pas connecté :
  // les cookies authjs.* présents sont nécessairement corrompus ou
  // expirés. On les supprime pour casser la boucle.
  if (req.nextUrl.pathname === "/login") {
    for (const name of AUTHJS_COOKIE_NAMES) {
      if (req.cookies.has(name)) {
        res.cookies.set(name, "", { maxAge: 0, path: "/" });
      }
    }
  }

  return res;
}

export const config = {
  matcher: [
    // Tous les paths sauf assets et favicons. On garde /api/* parce que
    // les réponses JSON aussi bénéficient des headers anti-sniffing.
    "/((?!_next/static|_next/image|favicon.ico|favicon.svg|icon.svg).*)",
  ],
};
