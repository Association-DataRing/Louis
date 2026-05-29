"use client";

import Link from "next/link";
import { IconInfoCircle, IconArrowUpRight } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// Base de la doc publique. Surchargeable (NEXT_PUBLIC_DOCS_URL) pour pointer
// vers un miroir self-hosted ; par défaut la doc officielle DataRing.
const DOCS_BASE =
  process.env.NEXT_PUBLIC_DOCS_URL ?? "https://louis.data-ring.net/docs";

/**
 * Petit bouton « info » (i) à poser près du titre d'un module. Au clic :
 * popover avec une aide contextuelle courte (setup/usage) + un lien vers la
 * page de documentation complète (nouvel onglet).
 *
 * Exemple :
 *   <ModuleHelp slug="user/getting-started" title="Prise en main">
 *     Configurez une clé provider, puis lancez votre première conversation.
 *   </ModuleHelp>
 */
export function ModuleHelp({
  slug,
  title,
  children,
  align = "start",
  label = "Aide sur ce module",
}: {
  /** Chemin de la page de doc, ex. "user/getting-started" (sans slash initial). */
  slug: string;
  /** Titre affiché en haut du popover. */
  title: string;
  /** Aide contextuelle courte (2-3 phrases). */
  children: React.ReactNode;
  align?: "start" | "center" | "end";
  /** aria-label du bouton (accessibilité). */
  label?: string;
}) {
  const href = `${DOCS_BASE}/${slug}`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground hover:text-foreground"
          aria-label={label}
        >
          <IconInfoCircle className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-80">
        <p className="font-heading text-sm font-medium tracking-tight">
          {title}
        </p>
        <div className="mt-1.5 text-sm text-muted-foreground [&_strong]:font-medium [&_strong]:text-foreground">
          {children}
        </div>
        <Link
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          En savoir plus
          <IconArrowUpRight className="size-3.5" />
        </Link>
      </PopoverContent>
    </Popover>
  );
}
