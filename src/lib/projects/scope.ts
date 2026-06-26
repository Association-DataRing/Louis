import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  projects,
  documentFolders,
  documents,
  documentChunks,
} from "@/db/schema";

/**
 * Modèle « dossier = projet » : un projet est rattaché à un dossier-racine
 * (`projects.folderId`) et ses documents sont tous ceux rangés dans ce
 * dossier ou un de ses sous-dossiers, récursivement. Ce helper résout ce
 * périmètre pour le scoping du RAG, l'affichage de la page projet et les
 * compteurs de la liste. `documents.projectId` n'est plus la source de
 * vérité de l'appartenance documentaire.
 */

export type ProjectScope = {
  folderId: string | null;
  folderIds: string[];
  documentIds: string[];
};

/** IDs des dossiers du sous-arbre enraciné en `rootFolderId` (inclus). */
function collectSubtree(
  rootFolderId: string,
  childrenByParent: Map<string | null, string[]>
): string[] {
  const out: string[] = [];
  const stack: string[] = [rootFolderId];
  while (stack.length > 0) {
    const id = stack.pop() as string;
    out.push(id);
    const children = childrenByParent.get(id);
    if (children) stack.push(...children);
  }
  return out;
}

function buildChildrenMap(
  folders: { id: string; parentFolderId: string | null }[]
): Map<string | null, string[]> {
  const childrenByParent = new Map<string | null, string[]>();
  for (const f of folders) {
    const list = childrenByParent.get(f.parentFolderId) ?? [];
    list.push(f.id);
    childrenByParent.set(f.parentFolderId, list);
  }
  return childrenByParent;
}

/**
 * Résout le périmètre documentaire d'un seul projet : son dossier-racine,
 * tous les dossiers de son sous-arbre, et les IDs des documents qu'ils
 * contiennent. Renvoie des listes vides si le projet n'a pas (ou plus) de
 * dossier rattaché.
 */
export async function getProjectScope(
  userId: string,
  projectId: string
): Promise<ProjectScope> {
  const [project] = await db
    .select({ folderId: projects.folderId })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);

  if (!project?.folderId) {
    return { folderId: project?.folderId ?? null, folderIds: [], documentIds: [] };
  }

  const folders = await db
    .select({
      id: documentFolders.id,
      parentFolderId: documentFolders.parentFolderId,
    })
    .from(documentFolders)
    .where(eq(documentFolders.userId, userId));

  const folderIds = collectSubtree(
    project.folderId,
    buildChildrenMap(folders)
  );

  // Appartenance documentaire = rangé dans un dossier du sous-arbre. On ne
  // filtre PAS par userId ici : le sous-arbre est déjà celui du propriétaire,
  // et un document déposé par un collaborateur dans ce dossier fait bien partie
  // du projet (collaboration). L'autorisation d'accès au projet est vérifiée
  // en amont (resolveProjectAccess).
  const docs = await db
    .select({ id: documents.id })
    .from(documents)
    .where(inArray(documents.folderId, folderIds));

  return {
    folderId: project.folderId,
    folderIds,
    documentIds: docs.map((d) => d.id),
  };
}

/**
 * IDs des documents rangés dans les sous-arbres des dossiers donnés
 * (récursif). Sert à la portée RAG « dossiers choisis » d'un agent (Board).
 * Filtré par `userId` : un dossier d'un autre tenant ne ramène jamais de
 * document (garde-fou en plus de l'intersection projet côté appelant).
 */
export async function getDocsInFolders(
  userId: string,
  folderIds: string[]
): Promise<string[]> {
  if (folderIds.length === 0) return [];

  const folders = await db
    .select({
      id: documentFolders.id,
      parentFolderId: documentFolders.parentFolderId,
    })
    .from(documentFolders)
    .where(eq(documentFolders.userId, userId));

  const childrenByParent = buildChildrenMap(folders);
  const allowed = new Set<string>();
  for (const fid of folderIds) {
    for (const id of collectSubtree(fid, childrenByParent)) allowed.add(id);
  }

  const docs = await db
    .select({ id: documents.id })
    .from(documents)
    .where(
      and(
        eq(documents.userId, userId),
        inArray(documents.folderId, Array.from(allowed))
      )
    );
  return docs.map((d) => d.id);
}

export type AgentSourceFolder = { id: string; name: string; depth: number };
export type AgentSourceDocument = {
  id: string;
  filename: string;
  folderId: string | null;
  indexed: boolean;
};

/**
 * Options pour les sélecteurs « Sources documentaires » d'un agent (Board) :
 * l'arborescence des dossiers de l'utilisateur (en ordre DFS avec profondeur
 * pour l'indentation) et ses documents (avec un flag `indexed` = au moins un
 * chunk RAG, comme la transparence de la page Documents).
 */
export async function getAgentSourceOptions(userId: string): Promise<{
  folders: AgentSourceFolder[];
  documents: AgentSourceDocument[];
}> {
  const [folderRows, docRows, chunkRows] = await Promise.all([
    db
      .select({
        id: documentFolders.id,
        name: documentFolders.name,
        parentFolderId: documentFolders.parentFolderId,
      })
      .from(documentFolders)
      .where(eq(documentFolders.userId, userId)),
    db
      .select({
        id: documents.id,
        filename: documents.filename,
        folderId: documents.folderId,
      })
      .from(documents)
      .where(eq(documents.userId, userId))
      .orderBy(asc(documents.filename)),
    db
      .selectDistinct({ documentId: documentChunks.documentId })
      .from(documentChunks)
      .innerJoin(documents, eq(documents.id, documentChunks.documentId))
      .where(eq(documents.userId, userId)),
  ]);

  const childrenByParent = buildChildrenMap(folderRows);
  const nameById = new Map(folderRows.map((f) => [f.id, f.name]));
  const byName = (a: string, b: string) =>
    (nameById.get(a) ?? "").localeCompare(nameById.get(b) ?? "");

  const folders: AgentSourceFolder[] = [];
  const visit = (id: string, depth: number) => {
    folders.push({ id, name: nameById.get(id) ?? id, depth });
    for (const child of (childrenByParent.get(id) ?? []).slice().sort(byName)) {
      visit(child, depth + 1);
    }
  };
  for (const root of (childrenByParent.get(null) ?? []).slice().sort(byName)) {
    visit(root, 0);
  }

  const indexed = new Set(chunkRows.map((r) => r.documentId));
  const documentsOut: AgentSourceDocument[] = docRows.map((d) => ({
    id: d.id,
    filename: d.filename,
    folderId: d.folderId,
    indexed: indexed.has(d.id),
  }));

  return { folders, documents: documentsOut };
}

/**
 * Compte les documents de chaque projet de l'utilisateur en une passe.
 * Évite N appels à `getProjectScope` sur la page liste des projets.
 */
export async function getProjectDocCounts(
  userId: string
): Promise<Map<string, number>> {
  const [projectRows, folders, docs] = await Promise.all([
    db
      .select({ id: projects.id, folderId: projects.folderId })
      .from(projects)
      .where(eq(projects.userId, userId)),
    db
      .select({
        id: documentFolders.id,
        parentFolderId: documentFolders.parentFolderId,
      })
      .from(documentFolders)
      .where(eq(documentFolders.userId, userId)),
    db
      .select({ id: documents.id, folderId: documents.folderId })
      .from(documents)
      .where(eq(documents.userId, userId)),
  ]);

  const childrenByParent = buildChildrenMap(folders);

  const docsByFolder = new Map<string, number>();
  for (const d of docs) {
    if (!d.folderId) continue;
    docsByFolder.set(d.folderId, (docsByFolder.get(d.folderId) ?? 0) + 1);
  }

  const counts = new Map<string, number>();
  for (const p of projectRows) {
    if (!p.folderId) {
      counts.set(p.id, 0);
      continue;
    }
    let n = 0;
    for (const fid of collectSubtree(p.folderId, childrenByParent)) {
      n += docsByFolder.get(fid) ?? 0;
    }
    counts.set(p.id, n);
  }
  return counts;
}
