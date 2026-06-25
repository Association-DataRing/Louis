import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { getObjectBytes } from "@/lib/storage";
import { decryptWithDek, unwrapDek } from "@/lib/crypto-envelope";

export type EncryptedDocFields = {
  encDek: string | null;
  encExtractedText: string | null;
  extractedTextNonce: string | null;
  extractedText: string | null;
};

/**
 * Déchiffre le texte extrait d'un document à partir des colonnes DB.
 * Gère la compatibilité ascendante : si encDek est null, retourne extractedText tel quel.
 */
export async function decryptDocumentText(
  doc: EncryptedDocFields
): Promise<string | null> {
  if (!doc.encDek) return doc.extractedText;
  if (!doc.encExtractedText || !doc.extractedTextNonce) return null;
  const dek = unwrapDek(doc.encDek);
  try {
    const cipher = Buffer.from(doc.encExtractedText, "base64");
    const plain = await decryptWithDek(cipher, dek, doc.extractedTextNonce);
    return plain.toString("utf8");
  } finally {
    dek.fill(0);
  }
}

/**
 * Récupère un document depuis la DB avec le texte extrait déchiffré en mémoire.
 */
export async function fetchDocumentDecrypted(
  id: string,
  userId: string
): Promise<(typeof documents.$inferSelect & { extractedText: string | null }) | null> {
  const [doc] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, id), eq(documents.userId, userId)))
    .limit(1);
  if (!doc) return null;
  const extractedText = await decryptDocumentText(doc);
  return { ...doc, extractedText };
}

/**
 * Récupère le blob binaire depuis S3 et le déchiffre si nécessaire.
 * Compatible avec les anciens documents non chiffrés (encDek null).
 */
export async function fetchDocumentBytes(doc: {
  storageKey: string;
  encDek: string | null;
  dekNonce: string | null;
}): Promise<Buffer> {
  const raw = Buffer.from(await getObjectBytes(doc.storageKey));
  if (!doc.encDek || !doc.dekNonce) return raw;
  const dek = unwrapDek(doc.encDek);
  try {
    return await decryptWithDek(raw, dek, doc.dekNonce);
  } finally {
    dek.fill(0);
  }
}
