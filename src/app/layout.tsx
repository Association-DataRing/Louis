import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import { cn } from "@/lib/utils";
import "./globals.css";

const geistMonoHeading = Geist_Mono({ subsets: ["latin"], variable: "--font-heading" });
const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

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
  authors: [{ name: "Altij Avocats", url: "https://altij.com" }],
  openGraph: {
    title: "Louis — L'IA juridique souveraine",
    description:
      "Plateforme IA open-source pour les professions juridiques. Vos clés, vos données, votre infrastructure.",
    locale: "fr_FR",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Louis — L'IA juridique souveraine",
    description:
      "Plateforme IA open-source pour les professions juridiques. AGPL-3.0, auto-hébergeable.",
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
        inter.variable,
        geistMonoHeading.variable,
        "font-sans"
      )}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
