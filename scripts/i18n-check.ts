/**
 * Vérifie que les catalogues de messages `fr` et `en` portent exactement les
 * mêmes clés (alignement strict). Sort en code 1 si une clé manque d'un côté
 * ou si une valeur est vide. Destiné à un usage CI / pré-PR.
 *
 *   npx tsx scripts/i18n-check.ts
 */
import fr from "../messages/fr";
import en from "../messages/en";

type Json = string | number | boolean | null | { [k: string]: Json } | Json[];

function flatten(obj: Json, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    for (const [k, v] of Object.entries(obj)) {
      const key = prefix ? `${prefix}.${k}` : k;
      if (v && typeof v === "object" && !Array.isArray(v)) {
        for (const [ik, iv] of flatten(v, key)) out.set(ik, iv);
      } else {
        out.set(key, String(v));
      }
    }
  }
  return out;
}

const frKeys = flatten(fr as Json);
const enKeys = flatten(en as Json);

const missingInEn = [...frKeys.keys()].filter((k) => !enKeys.has(k));
const missingInFr = [...enKeys.keys()].filter((k) => !frKeys.has(k));
const emptyFr = [...frKeys.entries()].filter(([, v]) => v.trim() === "").map(([k]) => k);
const emptyEn = [...enKeys.entries()].filter(([, v]) => v.trim() === "").map(([k]) => k);

let ok = true;
function report(label: string, keys: string[]) {
  if (keys.length === 0) return;
  ok = false;
  console.error(`\n✗ ${label} (${keys.length}) :`);
  for (const k of keys) console.error(`    ${k}`);
}

report("Clés présentes en fr mais absentes en en", missingInEn);
report("Clés présentes en en mais absentes en fr", missingInFr);
report("Valeurs vides en fr", emptyFr);
report("Valeurs vides en en", emptyEn);

if (ok) {
  console.log(`✓ i18n aligné — ${frKeys.size} clés, fr ↔ en cohérents.`);
  process.exit(0);
} else {
  console.error(`\n✗ Désalignement i18n détecté.`);
  process.exit(1);
}
