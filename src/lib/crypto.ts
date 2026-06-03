import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const SALT = "louis:provider-key:v1";

// scrypt est coûteux (~10-100ms par appel selon les params). On le dérive UNE
// fois au premier accès puis on cache la clé pour toute la durée du process.
// La sécurité réelle dépend de l'entropie d'ENCRYPTION_KEY (`openssl rand
// -base64 32`) — voir SECURITY.md.
let cachedKey: Buffer | null = null;
let cachedKeySource: string | null = null;

function getKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret || secret.length < 16) {
    throw new Error(
      "ENCRYPTION_KEY is missing or too short. Generate one with: openssl rand -base64 32"
    );
  }
  // Si l'ENCRYPTION_KEY change en cours de vie du process (hot reload dev,
  // rotation prod sans restart), on re-dérive. En prod normale, scrypt n'est
  // jamais ré-exécuté après le tout premier appel.
  if (cachedKey && cachedKeySource === secret) return cachedKey;
  cachedKey = scryptSync(secret, SALT, 32);
  cachedKeySource = secret;
  return cachedKey;
}

export type EncryptedBlob = {
  ciphertext: string;
  iv: string;
  tag: string;
};

export function encrypt(plaintext: string): EncryptedBlob {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  return {
    ciphertext: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
  };
}

/**
 * Échec de déchiffrement d'un secret : clé ENCRYPTION_KEY changée (rotation),
 * ou donnée corrompue/altérée. Erreur typée pour que les appelants distinguent
 * « secret indéchiffrable » (récupérable : re-saisir la clé) d'une vraie panne,
 * et puissent dégrader proprement plutôt que de propager un 500 opaque.
 */
export class DecryptError extends Error {
  constructor(cause?: unknown) {
    super(
      "Échec du déchiffrement d'un secret (clé ENCRYPTION_KEY changée, ou donnée corrompue/altérée)."
    );
    this.name = "DecryptError";
    if (cause !== undefined) (this as { cause?: unknown }).cause = cause;
  }
}

export function decrypt(blob: EncryptedBlob): string {
  // getKey() laisse remonter telle quelle l'erreur de CONFIG (ENCRYPTION_KEY
  // absente/trop courte) — c'est un problème d'exploitation, pas de donnée.
  const key = getKey();
  try {
    const decipher = createDecipheriv(ALGO, key, Buffer.from(blob.iv, "base64"));
    decipher.setAuthTag(Buffer.from(blob.tag, "base64"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(blob.ciphertext, "base64")),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch (err) {
    throw new DecryptError(err);
  }
}

export type DecryptResult =
  | { ok: true; value: string }
  | { ok: false; error: DecryptError };

/**
 * Variante non-throwing de decrypt(). Utile dans les boucles multi-secrets
 * (catalogue de modèles, liste de connecteurs) : un secret corrompu est sauté
 * proprement au lieu de faire échouer l'ensemble.
 */
export function tryDecrypt(blob: EncryptedBlob): DecryptResult {
  try {
    return { ok: true, value: decrypt(blob) };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof DecryptError ? err : new DecryptError(err),
    };
  }
}
