import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * TOTP (RFC 6238) maison — aucune dépendance externe. 2FA pour les comptes
 * (admin en priorité) : un admin détient les clés des données clients et le
 * rayon de souffle du chiffrement at-rest ; le mono-facteur est le maillon
 * faible d'un déploiement auto-hébergé.
 */

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP_SECONDS = 30;
const DIGITS = 6;

function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(str: string): Buffer {
  const clean = str.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const c of clean) {
    value = (value << 5) | BASE32.indexOf(c);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function hotp(secret: Buffer, counter: number): string {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", secret).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    (hmac[offset + 1] << 16) |
    (hmac[offset + 2] << 8) |
    hmac[offset + 3];
  return (code % 10 ** DIGITS).toString().padStart(DIGITS, "0");
}

/** Génère un secret base32 (160 bits, standard). */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

/** Code TOTP courant pour un secret (paramétrable pour les tests). */
export function totpCode(secret: string, atMs: number = Date.now()): string {
  const counter = Math.floor(atMs / 1000 / STEP_SECONDS);
  return hotp(base32Decode(secret), counter);
}

/**
 * Vérifie un token sur une fenêtre ±`window` pas (défaut 1 → tolère le pas
 * précédent/suivant, soit ±30 s). Comparaison en temps constant.
 */
export function verifyTotp(
  secret: string,
  token: string,
  atMs: number = Date.now(),
  window = 1
): boolean {
  const t = token.replace(/\s/g, "");
  if (!/^\d{6}$/.test(t)) return false;
  const counter = Math.floor(atMs / 1000 / STEP_SECONDS);
  const sec = base32Decode(secret);
  const tBuf = Buffer.from(t);
  for (let w = -window; w <= window; w++) {
    const candidate = Buffer.from(hotp(sec, counter + w));
    if (candidate.length === tBuf.length && timingSafeEqual(candidate, tBuf)) {
      return true;
    }
  }
  return false;
}

/** URI otpauth:// à entrer dans l'app d'authentification (clé manuelle). */
export function otpauthUri(
  secret: string,
  account: string,
  issuer = "Louis"
): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(
    issuer
  )}&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}`;
}

/** Codes de secours à usage unique (à stocker hachés). */
export function generateBackupCodes(n = 8): string[] {
  return Array.from({ length: n }, () =>
    randomBytes(5).toString("hex").toUpperCase()
  );
}
