/**
 * Diff ligne-à-ligne « maison » (H19) pour comparer deux versions du texte
 * extrait d'un document. Pas de dépendance externe : un LCS classique, mais
 * encadré pour rester sûr sur de gros documents juridiques.
 *
 * Stratégie :
 *  1. On retire le préfixe et le suffixe communs (cas le plus fréquent : une
 *     révision ne touche qu'un passage — inutile de comparer tout le reste).
 *  2. Sur la région divergente restante, on calcule le LCS en programmation
 *     dynamique, **plafonné** : au-delà de MAX_DP_LINES lignes de part et
 *     d'autre, la table O(n·m) deviendrait trop coûteuse — on retombe alors sur
 *     un « bloc remplacé » (tout l'ancien supprimé, tout le nouveau ajouté) en
 *     signalant la troncature à l'appelant.
 */

export type DiffOpType = "eq" | "add" | "del";
export type DiffOp = { type: DiffOpType; text: string };

/** Plafond de lignes pour la région comparée en DP (chaque côté). */
export const MAX_DP_LINES = 1500;

function splitLines(text: string): string[] {
  return text.replace(/\r\n?/g, "\n").split("\n");
}

export function diffLines(
  oldText: string,
  newText: string
): { ops: DiffOp[]; truncated: boolean } {
  const a = splitLines(oldText);
  const b = splitLines(newText);

  const prefix: DiffOp[] = [];
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) {
    prefix.push({ type: "eq", text: a[start] });
    start++;
  }

  const suffix: DiffOp[] = [];
  let endA = a.length - 1;
  let endB = b.length - 1;
  while (endA >= start && endB >= start && a[endA] === b[endB]) {
    suffix.push({ type: "eq", text: a[endA] });
    endA--;
    endB--;
  }
  suffix.reverse();

  const midA = a.slice(start, endA + 1);
  const midB = b.slice(start, endB + 1);

  const ops: DiffOp[] = [...prefix];
  let truncated = false;

  if (midA.length > MAX_DP_LINES || midB.length > MAX_DP_LINES) {
    truncated = true;
    for (const line of midA) ops.push({ type: "del", text: line });
    for (const line of midB) ops.push({ type: "add", text: line });
  } else {
    ops.push(...lcsDiff(midA, midB));
  }

  ops.push(...suffix);
  return { ops, truncated };
}

function lcsDiff(a: string[], b: string[]): DiffOp[] {
  const n = a.length;
  const m = b.length;
  if (n === 0 && m === 0) return [];
  if (n === 0) return b.map((text) => ({ type: "add" as const, text }));
  if (m === 0) return a.map((text) => ({ type: "del" as const, text }));

  const width = m + 1;
  // Longueurs LCS ≤ min(n, m) ≤ MAX_DP_LINES, donc Uint16 suffit largement.
  const dp = new Uint16Array((n + 1) * width);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      const here = i * width + j;
      if (a[i] === b[j]) {
        dp[here] = dp[(i + 1) * width + (j + 1)] + 1;
      } else {
        const down = dp[(i + 1) * width + j];
        const right = dp[i * width + (j + 1)];
        dp[here] = down >= right ? down : right;
      }
    }
  }

  const ops: DiffOp[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ type: "eq", text: a[i] });
      i++;
      j++;
    } else if (dp[(i + 1) * width + j] >= dp[i * width + (j + 1)]) {
      ops.push({ type: "del", text: a[i] });
      i++;
    } else {
      ops.push({ type: "add", text: b[j] });
      j++;
    }
  }
  while (i < n) ops.push({ type: "del", text: a[i++] });
  while (j < m) ops.push({ type: "add", text: b[j++] });
  return ops;
}

export type GapOp = { type: "gap"; count: number };
export type DisplayOp = DiffOp | GapOp;

/**
 * Replie les longues plages identiques en marqueurs « gap » (façon diff
 * unifié) : on ne garde que `context` lignes inchangées de part et d'autre de
 * chaque changement. Garde le rendu lisible ET le payload borné (sur une
 * révision typique, l'essentiel du texte est identique).
 */
export function collapseDiff(ops: DiffOp[], context = 3): DisplayOp[] {
  const keep = new Array<boolean>(ops.length).fill(false);
  for (let i = 0; i < ops.length; i++) {
    if (ops[i].type !== "eq") {
      keep[i] = true;
      for (let k = 1; k <= context; k++) {
        if (i - k >= 0) keep[i - k] = true;
        if (i + k < ops.length) keep[i + k] = true;
      }
    }
  }
  const out: DisplayOp[] = [];
  let gap = 0;
  for (let i = 0; i < ops.length; i++) {
    if (keep[i]) {
      if (gap > 0) {
        out.push({ type: "gap", count: gap });
        gap = 0;
      }
      out.push(ops[i]);
    } else {
      gap++;
    }
  }
  if (gap > 0) out.push({ type: "gap", count: gap });
  return out;
}

/** Compteur de lignes ajoutées / supprimées, pour un résumé « +x / −y ». */
export function diffStats(ops: DiffOp[]): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const op of ops) {
    if (op.type === "add") added++;
    else if (op.type === "del") removed++;
  }
  return { added, removed };
}
