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

/**
 * Metadata minimaliste — Louis se déploie en interne dans un cabinet,
 * donc pas d'optimisation SEO / Open Graph / Twitter ici. La page
 * marketing publique vit dans son propre repo (louis.data-ring.net).
 */
export const metadata: Metadata = {
  title: "Louis",
  description: "Plateforme IA juridique souveraine — accès privé.",
  robots: { index: false, follow: false },
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
