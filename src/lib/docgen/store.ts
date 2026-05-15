import { randomUUID } from "node:crypto";

/**
 * Store en mémoire des documents générés, indexé par UUID, avec TTL.
 *
 * Volontairement simple : tant que Louis tourne en single-instance
 * (l'usage interne cabinet), un Map JS suffit. Pour multi-instance il
 * faudrait passer par Redis ou S3.
 *
 * Cleanup paresseux : à chaque `put` on purge les entrées expirées. Pas
 * besoin d'un setInterval qui empêcherait le process de s'arrêter.
 */
export type Export = {
  buffer: Buffer;
  contentType: string;
  filename: string;
  /** Timestamp millis */
  expiresAt: number;
  userId: string;
};

const store = new Map<string, Export>();
const TTL_MS = 10 * 60 * 1000; // 10 minutes

function gc(): void {
  const now = Date.now();
  for (const [id, entry] of store) {
    if (entry.expiresAt < now) store.delete(id);
  }
}

export function putExport(
  buffer: Buffer,
  contentType: string,
  filename: string,
  userId: string
): string {
  gc();
  const id = randomUUID();
  store.set(id, {
    buffer,
    contentType,
    filename,
    userId,
    expiresAt: Date.now() + TTL_MS,
  });
  return id;
}

export function getExport(id: string): Export | null {
  const entry = store.get(id);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    store.delete(id);
    return null;
  }
  return entry;
}
