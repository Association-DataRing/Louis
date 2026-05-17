/**
 * Seed démo — initialise une instance Louis vide avec un user admin, un
 * projet d'exemple, un dossier documents, et la bibliothèque de workflows
 * juridiques par défaut (résumé d'arrêt, analyse de clause, comparaison,
 * due diligence, note de synthèse).
 *
 * Usage :
 *   ADMIN_EMAIL=demo@louis.local ADMIN_PASSWORD="$(openssl rand -base64 16)" npm run demo
 *
 * Idempotent : peut être relancé. Met à jour l'admin existant, et n'ajoute
 * un projet/dossier que si aucun n'existe déjà pour l'admin.
 *
 * Note : ce script n'importe pas de documents — ils dépendent de fichiers
 * binaires sous licence dont la redistribution doit être validée. Une fois
 * connecté, importez vos propres documents via `/documents` ou la palette
 * Cmd+K.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import {
  users,
  workflows,
  projects,
  documentFolders,
} from "../src/db/schema";

const DEMO_WORKFLOWS = [
  {
    name: "Résumé d'arrêt",
    description: "Synthèse structurée d'une décision de justice.",
    prompt:
      "Résume cet arrêt en 5 sections : 1) Faits matériels et procédure, 2) Prétentions des parties, 3) Motifs retenus par la juridiction, 4) Dispositif, 5) Portée et apports — citations entre guillemets quand utile.",
  },
  {
    name: "Analyse de clause",
    description: "Décortique une clause contractuelle.",
    prompt:
      "Analyse cette clause sur 4 axes : objet de la clause, obligations qu'elle impose, risques (juridiques, opérationnels, financiers), reformulation alternative plus protectrice pour mon client. Cite les passages pertinents.",
  },
  {
    name: "Comparaison de contrats",
    description: "Tableau comparatif sur les dimensions clés.",
    prompt:
      "Compare les contrats fournis sur un tableau avec ces colonnes : objet, durée, prix/honoraires, conditions de résiliation, clause RGPD, juridiction compétente, garanties. Une ligne par contrat.",
  },
  {
    name: "Due diligence rapide",
    description: "Profil juridique d'une entreprise.",
    prompt:
      "Fais une due diligence rapide sur l'entreprise mentionnée : forme juridique, capital, dirigeants, bénéficiaires effectifs, situation financière récente, contentieux connus, risques de réputation. Utilise les connecteurs Pappers/Légifrance si disponibles.",
  },
  {
    name: "Note de synthèse",
    description: "Note interne courte (1 page).",
    prompt:
      "Rédige une note de synthèse interne (max 1 page) en français juridique soutenu : contexte, question de droit, état du droit positif (textes + jurisprudence majeure), réponse argumentée, recommandation pratique. Ton sobre, factuel.",
  },
];

async function main() {
  const email = process.env.ADMIN_EMAIL ?? "demo@louis.local";
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME ?? "Admin Démo";

  if (!password) {
    console.error(
      "[demo] ADMIN_PASSWORD est requis. Génère-en un fort avec :\n" +
        '  ADMIN_PASSWORD="$(openssl rand -base64 16)" npm run demo\n'
    );
    process.exit(1);
  }
  if (password.length < 12) {
    console.error(
      "[demo] ADMIN_PASSWORD doit faire au moins 12 caractères.\n" +
        '  ADMIN_PASSWORD="$(openssl rand -base64 16)" npm run demo\n'
    );
    process.exit(1);
  }

  console.log(`[demo] Seed admin : ${email}`);
  const passwordHash = await bcrypt.hash(password, 12);

  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  let userId: string;
  if (existing) {
    await db
      .update(users)
      .set({ passwordHash, name, isActive: true, role: "admin" })
      .where(eq(users.id, existing.id));
    userId = existing.id;
    console.log(`[demo]   ✓ admin existant mis à jour`);
  } else {
    const [created] = await db
      .insert(users)
      .values({ email, name, passwordHash, role: "admin" })
      .returning({ id: users.id });
    userId = created.id;
    console.log(`[demo]   ✓ admin créé`);
  }

  console.log(`[demo] Import des workflows juridiques par défaut…`);
  const existingWf = await db
    .select({ id: workflows.id })
    .from(workflows)
    .where(eq(workflows.userId, userId));
  if (existingWf.length > 0) {
    console.log(`[demo]   ✓ ${existingWf.length} workflow(s) déjà présent(s), skip`);
  } else {
    await db
      .insert(workflows)
      .values(DEMO_WORKFLOWS.map((w) => ({ userId, ...w })));
    console.log(`[demo]   ✓ ${DEMO_WORKFLOWS.length} workflows importés`);
  }

  const [existingProject] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.userId, userId))
    .limit(1);
  if (!existingProject) {
    await db.insert(projects).values({
      userId,
      name: "Affaire pilote",
      description:
        "Projet de démo pour tester l'organisation par dossier client.",
    });
    console.log(`[demo]   ✓ projet 'Affaire pilote' créé`);
  } else {
    console.log(`[demo]   ✓ projet déjà présent, skip`);
  }

  const [existingFolder] = await db
    .select({ id: documentFolders.id })
    .from(documentFolders)
    .where(eq(documentFolders.userId, userId))
    .limit(1);
  if (!existingFolder) {
    await db.insert(documentFolders).values([
      { userId, name: "Contrats", parentFolderId: null },
      { userId, name: "Jurisprudences", parentFolderId: null },
      { userId, name: "Mémos internes", parentFolderId: null },
    ]);
    console.log(`[demo]   ✓ 3 dossiers documents créés`);
  } else {
    console.log(`[demo]   ✓ dossiers déjà présents, skip`);
  }

  console.log(`
[demo] Initialisation terminée.

   Connectez-vous sur http://localhost:3000 :
     email    : ${email}
     password : (celui que vous avez fourni — conservez-le)

   Étapes suggérées :
     1. Settings → Providers : ajoutez une clé Mistral (active le RAG)
     2. Cmd+K → Workflows : 5 prompts juridiques prêts à l'emploi
     3. Documents → Uploader un PDF/DOCX de votre choix
     4. Conversations → Posez une question, joignez le document
`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[demo] échec :", err);
    process.exit(1);
  });
