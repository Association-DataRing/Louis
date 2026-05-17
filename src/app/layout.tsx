import type { Metadata } from "next";
import { Geist, Geist_Mono, EB_Garamond } from "next/font/google";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

// Heading : EB Garamond, serif élégant, ton « justice » assumé.
// Body : Geist Sans (l'ancien fallback Inter cassait l'identité — Geist est
// neutre sans être générique). Mono reste Geist Mono.
const ebGaramond = EB_Garamond({
  subsets: ["latin"],
  variable: "--font-heading",
  weight: ["400", "500", "600", "700"],
});
const geistSans = Geist({ variable: "--font-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Louis — L'IA juridique souveraine",
  description:
    "Plateforme IA open-source pour les professions juridiques. Bring Your Own Key, connecteurs PISTE/Pappers, chat streaming, documents — auto-hébergé.",
  keywords: [
    "IA juridique",
    "intelligence artificielle avocat",
    "legal tech français",
    "RGPD",
    "souveraineté numérique",
    "open source",
    "BYOK",
    "Mistral",
    "Légifrance",
    "Pappers",
  ],
  authors: [{ name: "Association DataRing", url: "https://louis.data-ring.net" }],
  metadataBase: new URL("https://louis.data-ring.net"),
  openGraph: {
    title: "Louis — L'IA juridique souveraine",
    description:
      "Plateforme IA open-source pour les professions juridiques. Vos clés, vos données, votre infrastructure.",
    locale: "fr_FR",
    type: "website",
    url: "https://louis.data-ring.net",
    siteName: "Louis",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Louis — L'IA juridique souveraine. BYOK, AGPL-3.0, auto-hébergée.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Louis — L'IA juridique souveraine",
    description:
      "Plateforme IA open-source pour les professions juridiques. AGPL-3.0, auto-hébergeable.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      suppressHydrationWarning
      className={cn(
        "h-full antialiased",
        geistSans.variable,
        geistMono.variable,
        ebGaramond.variable,
        "font-sans"
      )}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
