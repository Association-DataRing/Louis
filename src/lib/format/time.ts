/**
 * Formatage de date relative en français — source UNIQUE (avant : deux copies
 * divergentes dans dashboard et admin/users). `nullLabel` permet d'adapter le
 * cas vide selon le contexte (« — » par défaut, « jamais utilisé » côté admin).
 */
export function formatRelativeFr(
  d: Date | string | null | undefined,
  nullLabel = "—"
): string {
  if (!d) return nullLabel;
  const date = typeof d === "string" ? new Date(d) : d;
  const ms = Date.now() - date.getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const days = Math.floor(h / 24);
  if (days < 30) return `il y a ${days} j`;
  if (days < 365) return `il y a ${Math.floor(days / 30)} mois`;
  return date.toLocaleDateString("fr-FR");
}
