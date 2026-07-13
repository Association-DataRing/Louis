import { useTranslations } from "next-intl";
import {
  IconExternalLink,
  IconScale,
  IconBuilding,
} from "@tabler/icons-react";

/**
 * Cartes de citation pour les sources juridiques externes (R3). Les outils
 * legifrance_search / pappers_* renvoyaient jusqu'ici une simple pill grise
 * « Terminé » qui jetait les URLs sources — alors que « Louis cite ses
 * sources » est une promesse centrale. Ces cartes rendent chaque source
 * cliquable (lien externe, nouvel onglet).
 *
 * Composants présentationnels purs (pas de hook) → pas de directive « use
 * client » nécessaire ; intégrés au bundle client via chat-shell.
 */

export type LegifranceHitView = {
  id: string;
  title: string;
  url: string;
  excerpt?: string;
};

export type PappersResultView = {
  nom_entreprise: string;
  siren: string;
  ville?: string | null;
  code_postal?: string | null;
  forme_juridique?: string | null;
};

export type PappersDetailsView = {
  nom_entreprise: string;
  siren: string;
  forme_juridique?: string | null;
  capital?: number | null;
  effectif?: string | null;
  siege?: {
    adresse_ligne_1?: string | null;
    code_postal?: string | null;
    ville?: string | null;
  } | null;
  dirigeants?: Array<{ nom?: string; prenom?: string; qualite?: string }>;
};

/**
 * Défense en profondeur : ces URLs proviennent de réponses d'API externes
 * (PISTE/Pappers) et alimentent un `href`. On n'autorise que http(s) — un
 * schéma `javascript:`/`data:` ne doit jamais atteindre un href cliquable.
 */
function safeHttpUrl(u: string): string | null {
  try {
    const parsed = new URL(u);
    return parsed.protocol === "https:" || parsed.protocol === "http:"
      ? parsed.toString()
      : null;
  } catch {
    return null;
  }
}

/** Rend un lien externe si l'URL est sûre, sinon un bloc non-cliquable
 * (la citation reste visible). */
function ExternalCard({
  href,
  className,
  children,
}: {
  href: string | null;
  className: string;
  children: React.ReactNode;
}) {
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
      </a>
    );
  }
  return <div className={className}>{children}</div>;
}

function CardShell({
  icon,
  source,
  count,
  children,
}: {
  icon: React.ReactNode;
  source: string;
  count?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs flex flex-col gap-1.5 max-w-[85%] motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-300">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="font-medium text-foreground">{source}</span>
        {count && <span className="ml-auto text-[10px]">{count}</span>}
      </div>
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
}

export function LegifranceCitations({ hits }: { hits: LegifranceHitView[] }) {
  const t = useTranslations("chat");
  return (
    <CardShell
      icon={<IconScale className="size-3 text-primary" />}
      source="Légifrance"
      count={t("citations.sourcesCount", { count: hits.length })}
    >
      {hits.map((h, i) => (
        <ExternalCard
          key={`${h.id}-${i}`}
          href={safeHttpUrl(h.url)}
          className="flex flex-col gap-0.5 rounded-md bg-background border border-border px-2 py-1.5 hover:border-primary/50 transition-colors group"
        >
          <span className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-foreground group-hover:text-primary truncate flex-1 min-w-0">
              {h.title}
            </span>
            <IconExternalLink className="size-3 text-muted-foreground shrink-0" />
          </span>
          {h.excerpt && (
            <span className="text-[11px] text-muted-foreground line-clamp-2">
              {h.excerpt}
            </span>
          )}
          <span className="text-[10px] text-muted-foreground/70">
            legifrance.gouv.fr
          </span>
        </ExternalCard>
      ))}
    </CardShell>
  );
}

function pappersUrl(siren: string): string {
  return `https://www.pappers.fr/entreprise/${siren.replace(/\s/g, "")}`;
}

export function PappersResults({ results }: { results: PappersResultView[] }) {
  const t = useTranslations("chat");
  return (
    <CardShell
      icon={<IconBuilding className="size-3 text-primary" />}
      source="Pappers"
      count={t("citations.companiesCount", { count: results.length })}
    >
      {results.map((r, i) => (
        <ExternalCard
          key={`${r.siren}-${i}`}
          href={safeHttpUrl(pappersUrl(r.siren))}
          className="flex flex-col gap-0.5 rounded-md bg-background border border-border px-2 py-1.5 hover:border-primary/50 transition-colors group"
        >
          <span className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-foreground group-hover:text-primary truncate flex-1 min-w-0">
              {r.nom_entreprise}
            </span>
            <IconExternalLink className="size-3 text-muted-foreground shrink-0" />
          </span>
          <span className="text-[11px] text-muted-foreground">
            SIREN {r.siren}
            {r.forme_juridique ? ` · ${r.forme_juridique}` : ""}
            {r.ville ? ` · ${r.ville}` : ""}
          </span>
        </ExternalCard>
      ))}
    </CardShell>
  );
}

export function PappersCompany({ d }: { d: PappersDetailsView }) {
  const t = useTranslations("chat");
  const dirigeants = (d.dirigeants ?? []).slice(0, 4);
  return (
    <CardShell
      icon={<IconBuilding className="size-3 text-primary" />}
      source={t("citations.pappersCompanySource")}
    >
      <ExternalCard
        href={safeHttpUrl(pappersUrl(d.siren))}
        className="flex flex-col gap-1 rounded-md bg-background border border-border px-2 py-1.5 hover:border-primary/50 transition-colors group"
      >
        <span className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-foreground group-hover:text-primary truncate flex-1 min-w-0">
            {d.nom_entreprise}
          </span>
          <IconExternalLink className="size-3 text-muted-foreground shrink-0" />
        </span>
        <span className="text-[11px] text-muted-foreground">
          SIREN {d.siren}
          {d.forme_juridique ? ` · ${d.forme_juridique}` : ""}
          {typeof d.capital === "number"
            ? ` · capital ${d.capital.toLocaleString("fr-FR")} €`
            : ""}
          {d.effectif ? ` · ${d.effectif}` : ""}
        </span>
        {d.siege && (d.siege.adresse_ligne_1 || d.siege.ville) && (
          <span className="text-[11px] text-muted-foreground">
            {[d.siege.adresse_ligne_1, d.siege.code_postal, d.siege.ville]
              .filter(Boolean)
              .join(" ")}
          </span>
        )}
        {dirigeants.length > 0 && (
          <span className="text-[11px] text-muted-foreground">
            {dirigeants
              .map((p) =>
                [p.prenom, p.nom].filter(Boolean).join(" ") +
                (p.qualite ? ` (${p.qualite})` : "")
              )
              .join(" · ")}
          </span>
        )}
      </ExternalCard>
    </CardShell>
  );
}
