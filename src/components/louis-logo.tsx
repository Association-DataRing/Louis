/**
 * Logo Louis — clé ancienne style royal.
 *
 * Bow circulaire avec croix intérieure (référence au cachet et au sceau
 * royal), shaft diagonale, deux dents perpendiculaires. Symbolise à la fois
 * la clé du droit, la souveraineté ("vos clés"), et l'archive ancienne.
 *
 * Stroke-only en `currentColor` → s'adapte à toutes les surfaces, peut
 * être teinté via Tailwind (e.g. `text-primary`).
 */
export function LouisLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="7" cy="7" r="5" />
      <path d="M7 4 L7 10" />
      <path d="M4 7 L10 7" />
      <path d="M10.5 10.5 L19.5 19.5" />
      <path d="M14.5 16.5 L16.5 14.5" />
      <path d="M17 19 L19 17" />
    </svg>
  );
}
