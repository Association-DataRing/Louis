import {
  IconPlus,
  IconArrowUp,
  IconFileText,
  IconDownload,
  IconX,
  IconCircleCheck,
} from "@tabler/icons-react";
import { LouisLogo } from "@/components/louis-logo";

/**
 * Panneau de marque (colonne droite du split login).
 *
 * Toujours sombre, indépendamment du thème clair/sombre : c'est une surface
 * de marque fixe, façon « sceau royal » — d'où les couleurs en dur (white/…,
 * oklch fixes) plutôt que les tokens de thème, qui s'inverseraient en dark et
 * casseraient le contraste. Tout reste sur le hue 265° (bleu de France).
 *
 * La pièce maîtresse est une *vitrine produit* : un mock statique de l'app
 * (composer, message, étape agent, document généré en split-pane, citation
 * surlignée) — pour montrer la valeur dès l'écran de connexion, à la manière
 * d'un hero produit. Purement décoratif → masqué aux lecteurs d'écran
 * (aria-hidden) et caché sous `lg` pour laisser toute la place au formulaire.
 */
export function LoginAside() {
  return (
    <aside
      aria-hidden
      className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:border-l lg:border-white/10 lg:p-12 xl:p-16"
      style={{
        background:
          "linear-gradient(150deg, oklch(0.30 0.15 265) 0%, oklch(0.19 0.10 265) 55%, oklch(0.13 0.05 265) 100%)",
      }}
    >
      {/* Grille fine façon guilloché, atténuée par un masque radial. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px)",
          backgroundSize: "38px 38px",
          maskImage:
            "radial-gradient(ellipse 80% 70% at 50% 30%, black, transparent 75%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 80% 70% at 50% 30%, black, transparent 75%)",
        }}
      />
      {/* Halo lumineux haut-gauche. */}
      <div
        className="pointer-events-none absolute -left-1/4 -top-1/4 size-[40rem]"
        style={{
          background:
            "radial-gradient(circle, oklch(0.55 0.2 265 / 0.3), transparent 60%)",
        }}
      />
      {/* Sceau en filigrane, derrière la vitrine. */}
      <LouisLogo className="pointer-events-none absolute -bottom-28 -right-24 size-[34rem] text-white/[0.03]" />

      {/* Lockup de marque. */}
      <div className="relative z-10 flex items-center gap-2 text-white">
        <LouisLogo className="size-6" />
        <span className="font-heading text-lg tracking-tight">Louis</span>
      </div>

      {/* Vitrine produit. */}
      <div className="relative z-10 flex flex-1 items-center py-10">
        <ProductMock />
      </div>

      {/* Accroche éditoriale + signaux de confiance. */}
      <div className="relative z-10 max-w-md">
        <p className="font-heading text-2xl leading-snug text-white xl:text-3xl">
          De la question à l’acte —
          <br />
          sous votre seul contrôle.
        </p>
        <p className="mt-5 text-xs tracking-wide text-white/45">
          Chiffrement at-rest&ensp;·&ensp;Double authentification&ensp;·&ensp;Journal
          d’audit
        </p>
      </div>
    </aside>
  );
}

/** Accent bleu de France fixe, lisible sur le fond sombre du panneau. */
const ACCENT = "oklch(0.62 0.19 265)";

/**
 * Maquette statique de l'app, façon fenêtre flottante. Tout est décoratif :
 * barres de squelette plutôt que vrai texte, une seule ligne « citée »
 * surlignée en ambre (rappel de la feature citations), un seul accent bleu
 * (puce de génération + bouton d'envoi).
 */
function ProductMock() {
  return (
    <div className="relative w-full">
      {/* Carte fantôme en retrait — donne de la profondeur à la pile. */}
      <div className="absolute inset-x-6 -bottom-4 top-6 rounded-2xl border border-white/[0.06] bg-white/[0.02]" />

      {/* Fenêtre applicative. */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] shadow-2xl shadow-black/50 backdrop-blur-sm">
        {/* Barre de titre. */}
        <div className="flex h-9 items-center gap-2 border-b border-white/10 px-3.5">
          <span className="flex gap-1.5">
            <span className="size-2 rounded-full bg-white/15" />
            <span className="size-2 rounded-full bg-white/15" />
            <span className="size-2 rounded-full bg-white/15" />
          </span>
          <span className="ml-2 text-[11px] text-white/40">
            Nouvelle assignation
          </span>
          <span className="ml-auto flex items-center gap-1 text-[10px] text-white/35">
            <span
              className="size-1.5 rounded-full"
              style={{ backgroundColor: ACCENT }}
            />
            Mistral Large
          </span>
        </div>

        {/* Corps : conversation à gauche, document généré à droite. */}
        <div className="flex h-[240px]">
          {/* Rail conversation. */}
          <div className="flex w-[44%] shrink-0 flex-col gap-3 border-r border-white/10 p-3">
            {/* Message utilisateur. */}
            <div className="ml-auto max-w-[88%] space-y-1 rounded-lg rounded-br-sm bg-white/10 px-2.5 py-2">
              <div className="h-1.5 w-24 rounded-full bg-white/35" />
              <div className="h-1.5 w-16 rounded-full bg-white/25" />
            </div>

            {/* Réponse assistant : étapes agent. */}
            <div className="flex items-start gap-1.5">
              <LouisLogo className="mt-0.5 size-3.5 shrink-0 text-white/50" />
              <div className="flex-1 space-y-1.5">
                <div className="flex items-center gap-1.5 text-[10px] text-white/45">
                  <IconCircleCheck className="size-3 text-white/55" />
                  Sources vérifiées
                </div>
                <div className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1.5">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="size-1.5 rounded-full motion-safe:animate-pulse"
                      style={{ backgroundColor: ACCENT }}
                    />
                    <span className="text-[10px] text-white/50">
                      Rédaction du document…
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Document généré (split-pane). */}
          <div className="flex flex-1 flex-col">
            {/* En-tête du document. */}
            <div className="flex h-7 items-center gap-1.5 border-b border-white/10 px-2.5">
              <IconFileText className="size-3 text-white/40" />
              <span className="text-[10px] text-white/55">assignation.docx</span>
              <span className="ml-auto flex gap-1 text-white/30">
                <IconDownload className="size-3" />
                <IconX className="size-3" />
              </span>
            </div>

            {/* Page A4. */}
            <div className="flex-1 overflow-hidden p-2.5">
              <div className="h-full rounded-md bg-white/[0.06] px-3 py-2.5">
                <p className="font-heading text-[11px] leading-tight tracking-wide text-white/80">
                  TRIBUNAL JUDICIAIRE DE PARIS
                </p>
                <div className="mt-1 h-1 w-16 rounded-full bg-white/15" />
                <div className="mt-3 space-y-1.5">
                  <div className="h-1.5 w-full rounded-full bg-white/10" />
                  <div className="h-1.5 w-[92%] rounded-full bg-white/10" />
                  {/* Ligne citée — surlignage ambre (feature citations). */}
                  <div
                    className="h-1.5 w-[80%] rounded-full"
                    style={{ backgroundColor: "oklch(0.82 0.13 90 / 0.32)" }}
                  />
                  <div className="h-1.5 w-[96%] rounded-full bg-white/10" />
                  <div className="h-1.5 w-[68%] rounded-full bg-white/10" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Composer. */}
        <div className="border-t border-white/10 p-2.5">
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5">
            <IconPlus className="size-3.5 text-white/40" />
            <span className="text-[11px] text-white/30">
              Posez une question juridique…
            </span>
            <span
              className="ml-auto inline-flex size-5 items-center justify-center rounded-md"
              style={{ backgroundColor: ACCENT }}
            >
              <IconArrowUp className="size-3 text-white" />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
