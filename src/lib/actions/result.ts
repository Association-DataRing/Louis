/**
 * Résultat standard d'une server action. `T` ajoute des champs au cas succès :
 *   ActionResult                       → { ok: true } | { ok: false; error }
 *   ActionResult<{ id: string }>       → { ok: true; id } | { ok: false; error }
 *
 * Centralisé pour ne plus redéfinir le même type dans chaque `actions.ts`
 * (auparavant ~13 copies, avec de légères divergences).
 */
export type ActionResult<T = object> =
  | ({ ok: true } & T)
  | { ok: false; error: string };
