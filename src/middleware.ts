import { NextResponse } from "next/server";

/**
 * Middleware Next.js — applique les headers de sécurité HTTP sur toutes les
 * réponses. Couvre les recommandations OWASP de base : HSTS, anti-clickjacking,
 * anti-MIME-sniffing, contrôle Referer, restriction Permissions-Policy.
 *
 * La CSP est volontairement permissive sur les scripts inline en v0.1 — Next
 * injecte des scripts d'hydration inline et React Compiler génère du code
 * inline. Un durcissement strict-dynamic + nonces est prévu en v0.1.x une
 * fois la chaîne complète Next.js / shadcn / EB Garamond audités.
 *
 * Le matcher exclut les assets statiques (next/static, next/image, favicon)
 * pour éviter d'inonder les binaires de headers HTML-spécifiques.
 */

const isProd = process.env.NODE_ENV === "production";

const CSP = [
  "default-src 'self'",
  // 'unsafe-inline' nécessaire pour Next/React hydration. À durcir Phase 3+
  // via nonces.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  // Tailwind v4 + shadcn génèrent du CSS inline pour les variables, garder
  // 'unsafe-inline' sur les styles.
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

export function middleware() {
  const res = NextResponse.next();

  res.headers.set("Content-Security-Policy", CSP);
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=()"
  );
  // X-Frame-Options en complément de frame-ancestors pour les vieux clients
  res.headers.set("X-Frame-Options", "DENY");

  // HSTS : 1 an, sub-domains, preload. UNIQUEMENT en prod (en dev on tape
  // http://localhost et un HSTS leaké casserait le dev local de l'admin).
  if (isProd) {
    res.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload"
    );
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
