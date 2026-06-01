import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { projects, documentFolders, documents } from "@/db/schema";

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

  const docs = await db
    .select({ id: documents.id })
    .from(documents)
    .where(
      and(eq(documents.userId, userId), inArray(documents.folderId, folderIds))
    );

  return {
    folderId: project.folderId,
    folderIds,
    documentIds: docs.map((d) => d.id),
  };
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
