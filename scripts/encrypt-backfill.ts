/**
 * ADR 0005 Phase 1 — Backfill de chiffrement des documents existants.
 *
 * Usage :
 *   npx tsx scripts/encrypt-backfill.ts [--dry-run] [--batch=50]
 *
 * Chiffre les documents dont enc_dek IS NULL (= non encore chiffrés).
 * Remplace le blob S3 par le ciphertext XChaCha20, stocke les champs
 * enc_* en DB, et met extracted_text à null (le texte vit désormais dans
 * enc_extracted_text).
 */

import "dotenv/config";
import { eq, isNull } from "drizzle-orm";
import { db } from "../src/db";
import { documents } from "../src/db/schema";
import { getObjectBytes, uploadObject } from "../src/lib/storage";
import {
  generateDek,
  encryptWithDek,
  wrapDek,
} from "../src/lib/crypto-envelope";

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const batchArg = args.find((a) => a.startsWith("--batch="));
const BATCH = batchArg ? parseInt(batchArg.split("=")[1], 10) : 50;

async function run() {
  console.log(`[backfill] démarrage — dry-run=${DRY_RUN} batch=${BATCH}`);

  let offset = 0;
  let totalOk = 0;
  let totalErr = 0;

  while (true) {
    const batch = await db
      .select({
        id: documents.id,
        storageKey: documents.storageKey,
        contentType: documents.contentType,
        extractedText: documents.extractedText,
      })
      .from(documents)
      .where(isNull(documents.encDek))
      .limit(BATCH)
      .offset(offset);

    if (batch.length === 0) break;

    for (const doc of batch) {
      try {
        // Télécharger le blob en clair depuis S3
        const rawBytes = Buffer.from(await getObjectBytes(doc.storageKey));

        // Générer DEK + chiffrer
        const dek = await generateDek();
        let encryptedBuffer: Buffer;
        let dekNonce: string;
        let encExtractedText: string | null = null;
        let extractedTextNonce: string | null = null;
        let encDek: string;
        try {
          const encBlob = await encryptWithDek(rawBytes, dek);
          encryptedBuffer = encBlob.ciphertext;
          dekNonce = encBlob.nonce;
          if (doc.extractedText) {
            const encText = await encryptWithDek(
              Buffer.from(doc.extractedText, "utf8"),
              dek
            );
            encExtractedText = encText.ciphertext.toString("base64");
            extractedTextNonce = encText.nonce;
          }
          encDek = wrapDek(dek);
        } finally {
          dek.fill(0);
        }

        if (!DRY_RUN) {
          // Upload du blob chiffré (remplace le blob en clair)
          await uploadObject(doc.storageKey, encryptedBuffer, doc.contentType);
          // Mise à jour en DB
          await db
            .update(documents)
            .set({
              encDek,
              dekNonce,
              encExtractedText,
              extractedTextNonce,
              extractedText: null,
            })
            .where(eq(documents.id, doc.id));
        }

        totalOk++;
        if (totalOk % 10 === 0) {
          console.log(`[backfill] ${totalOk} documents traités (${totalErr} erreurs)`);
        }
      } catch (err) {
        totalErr++;
        console.error(`[backfill] erreur doc ${doc.id}:`, err);
      }
    }

    // Pour DRY_RUN : avance l'offset (sinon le même batch revient toujours).
    // Pour le run réel : les docs mis à jour ne figurent plus dans la requête.
    if (DRY_RUN) {
      offset += batch.length;
    }
  }

  console.log(
    `[backfill] terminé — ${totalOk} chiffrés, ${totalErr} erreurs${DRY_RUN ? " (DRY RUN — aucune modification)" : ""}`
  );
}

run().catch((err) => {
  console.error("[backfill] fatal:", err);
  process.exit(1);
});
