/**
 * Test d'intégration ADR 0005 Phase 1.
 * Vérifie le cycle complet : upload chiffré → blob S3 illisible → déchiffrement correct.
 *
 * Requiert : DB Postgres + MinIO accessibles (docker-compose up -d)
 * Usage : npx tsx scripts/test-encryption.ts
 */
import "dotenv/config";
import { eq, sql } from "drizzle-orm";
import { db } from "../src/db";
import { documents } from "../src/db/schema";
import { uploadObject, getObjectBytes } from "../src/lib/storage";
import {
  generateDek,
  encryptWithDek,
  decryptWithDek,
  wrapDek,
  unwrapDek,
} from "../src/lib/crypto-envelope";
import { decryptDocumentText, fetchDocumentBytes } from "../src/lib/document-crypto";
import { nanoid } from "nanoid";

const PASS = "✅";
const FAIL = "❌";

function check(label: string, ok: boolean) {
  console.log(`  ${ok ? PASS : FAIL} ${label}`);
  if (!ok) process.exitCode = 1;
}

async function main() {
  console.log("\n=== ADR 0005 Phase 1 — Test intégration chiffrement ===\n");

  // ── 1. Vérifier colonnes en DB ───────────────────────────────────────────
  console.log("1. Schéma DB");
  const cols = await db.execute(sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'documents'
    AND column_name IN ('enc_dek','dek_nonce','enc_extracted_text','extracted_text_nonce')
    ORDER BY column_name
  `);
  // postgres-js via drizzle retourne les rows directement en tableau
  const colRows = cols as unknown as Array<Record<string, string>>;
  const colNames = colRows.map((r) => r.column_name);
  check("enc_dek présent", colNames.includes("enc_dek"));
  check("dek_nonce présent", colNames.includes("dek_nonce"));
  check("enc_extracted_text présent", colNames.includes("enc_extracted_text"));
  check("extracted_text_nonce présent", colNames.includes("extracted_text_nonce"));

  // ── 2. Round-trip XChaCha20 ─────────────────────────────────────────────
  console.log("\n2. Primitives crypto");
  const dek = await generateDek();
  const plainText = "Contrat de travail — données confidentielles du cabinet.";
  const plainBuf = Buffer.from(plainText, "utf8");

  const { ciphertext, nonce } = await encryptWithDek(plainBuf, dek);
  const decrypted = await decryptWithDek(ciphertext, dek, nonce);

  check("DEK = 32 bytes", dek.length === 32);
  check("Ciphertext ≠ plaintext", !ciphertext.equals(plainBuf));
  check("Round-trip decrypt", decrypted.toString("utf8") === plainText);

  const wrapped = wrapDek(dek);
  const unwrapped = unwrapDek(wrapped);
  check("DEK wrap/unwrap", Buffer.from(dek).equals(Buffer.from(unwrapped)));

  // ── 3. Upload chiffré en S3 ─────────────────────────────────────────────
  console.log("\n3. Upload document chiffré dans MinIO");
  const FAKE_USER_ID = "00000000-0000-0000-0000-000000000001";
  const pdfContent = Buffer.from("%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n>>\nendobj\ntrailer\n<<\n/Root 1 0 R\n>>"); // mini PDF factice
  const pdfText = "Texte extrait du document PDF de test. Contient des données juridiques sensibles.";
  const storageKey = `${FAKE_USER_ID}/test-${nanoid()}-test.pdf`;

  const dek2 = await generateDek();
  let encDek: string;
  let dekNonce: string;
  let encExtractedText: string;
  let extractedTextNonce: string;
  let encryptedBlob: Buffer;

  try {
    const eb = await encryptWithDek(pdfContent, dek2);
    encryptedBlob = eb.ciphertext;
    dekNonce = eb.nonce;
    const et = await encryptWithDek(Buffer.from(pdfText, "utf8"), dek2);
    encExtractedText = et.ciphertext.toString("base64");
    extractedTextNonce = et.nonce;
    encDek = wrapDek(dek2);
  } finally {
    dek2.fill(0);
  }

  // Upload du blob chiffré
  await uploadObject(storageKey, encryptedBlob, "application/pdf");
  check("Upload MinIO OK", true);

  // Vérifier que le blob stocké n'est pas un PDF lisible
  const rawBytes = Buffer.from(await getObjectBytes(storageKey));
  const isPdf = rawBytes.slice(0, 4).toString() === "%PDF";
  check("Blob S3 n'est plus un PDF lisible", !isPdf);

  // ── 4. Insert en DB et déchiffrement via helper ──────────────────────────
  console.log("\n4. Persistance DB + déchiffrement");

  // On a besoin d'un userId réel — on cherche n'importe quel user existant
  const anyUsers = await db.execute(sql`SELECT id FROM users LIMIT 1`);
  const userId = (anyUsers as unknown as Array<{id: string}>)[0]?.id ?? FAKE_USER_ID;

  let docId: string | null = null;
  try {
    const [row] = await db.insert(documents).values({
      userId,
      filename: "test-adr0005.pdf",
      contentType: "application/pdf",
      sizeBytes: pdfContent.length,
      storageKey,
      encDek,
      dekNonce,
      encExtractedText,
      extractedTextNonce,
      textFormat: "text",
      extractionStatus: "ok",
    }).returning({ id: documents.id });
    docId = row.id;
    check("Insert document chiffré en DB", true);
  } catch (e) {
    check("Insert document chiffré en DB", false);
    console.error("    ", e);
  }

  if (docId) {
    // Déchiffrement du texte via helper
    const [docRow] = await db.select().from(documents).where(eq(documents.id, docId)).limit(1);
    const decText = await decryptDocumentText(docRow);
    check("decryptDocumentText retourne le texte en clair", decText === pdfText);
    check("extractedText colonne est null (pas de clair en DB)", docRow.extractedText === null);
    check("encDek est non-null", docRow.encDek !== null);

    // Déchiffrement du blob S3 via helper
    const decBlob = await fetchDocumentBytes(docRow);
    check("fetchDocumentBytes retourne le PDF original", decBlob.slice(0, 4).toString() === "%PDF");
    check("Taille du blob déchiffré correcte", decBlob.length === pdfContent.length);

    // Nettoyage
    await db.delete(documents).where(eq(documents.id, docId));
  }

  // Cleanup S3
  try {
    const { deleteObject } = await import("../src/lib/storage");
    await deleteObject(storageKey);
  } catch {}

  // ── 5. Compatibilité ascendante (doc legacy sans enc_dek) ────────────────
  console.log("\n5. Compatibilité ascendante (docs non chiffrés)");
  const legacyDoc = {
    extractedText: "Ancien texte en clair",
    encDek: null,
    encExtractedText: null,
    extractedTextNonce: null,
  };
  const legacyText = await decryptDocumentText(legacyDoc);
  check("Doc legacy retourne extractedText tel quel", legacyText === "Ancien texte en clair");

  // ── Résumé ───────────────────────────────────────────────────────────────
  const code = process.exitCode ?? 0;
  console.log(`\n${code === 0 ? PASS : FAIL} Résultat : ${code === 0 ? "tous les tests OK" : "ÉCHEC — voir ci-dessus"}\n`);
  process.exit(code);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
