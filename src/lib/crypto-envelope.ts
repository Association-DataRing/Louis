import { getSodium } from "./sodium";
import { encrypt, decrypt, type EncryptedBlob } from "./crypto";

export async function generateDek(): Promise<Uint8Array> {
  const sodium = await getSodium();
  return sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_KEYBYTES);
}

export async function encryptWithDek(
  plain: Buffer,
  dek: Uint8Array
): Promise<{ ciphertext: Buffer; nonce: string }> {
  const sodium = await getSodium();
  const nonce = sodium.randombytes_buf(
    sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES
  );
  const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
    plain,
    null,
    null,
    nonce,
    dek
  );
  return {
    ciphertext: Buffer.from(ciphertext),
    nonce: Buffer.from(nonce).toString("base64"),
  };
}

export async function decryptWithDek(
  ciphertext: Buffer,
  dek: Uint8Array,
  nonce: string
): Promise<Buffer> {
  const sodium = await getSodium();
  const nonceBytes = Buffer.from(nonce, "base64");
  const plaintext = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
    null,
    ciphertext,
    null,
    nonceBytes,
    dek
  );
  return Buffer.from(plaintext);
}

// Sérialise le DEK chiffré : le DEK (bytes) est converti en hex, puis
// enveloppé par la master key AES-GCM du crypto.ts existant.
export function wrapDek(dek: Uint8Array): string {
  const blob = encrypt(Buffer.from(dek).toString("hex"));
  return JSON.stringify(blob);
}

export function unwrapDek(encDek: string): Uint8Array {
  const blob = JSON.parse(encDek) as EncryptedBlob;
  const hex = decrypt(blob);
  return Uint8Array.from(Buffer.from(hex, "hex"));
}
