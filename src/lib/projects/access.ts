import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  projects,
  projectMembers,
  users,
  documents,
  documentFolders,
} from "@/db/schema";

/**
 * Brique d'autorisation centrale du partage de projet. Tout accès à un projet
 * (page, conversations, documents, RAG, outils) passe par `resolveProjectAccess`
 * plutôt que par un `eq(projects.userId, currentUser)` dispersé.
 *
 * Modèle MVP (intra-cabinet, « membre = accès complet ») :
 *  - le PROPRIÉTAIRE (`projects.userId`) a tous les droits ;
 *  - un MEMBRE (ligne dans `project_members`) a un accès lecture + écriture au
 *    périmètre du projet ;
 *  - un ADMIN du cabinet a accès (gestion centralisée — choix MVP assumé : un
 *    admin a déjà des pouvoirs étendus sur l'instance).
 *
 * Le périmètre documentaire reste celui du PROPRIÉTAIRE (`ownerId`) : les
 * dossiers/documents du projet lui appartiennent. Les helpers de scope doivent
 * donc être appelés avec `access.ownerId`, pas avec l'utilisateur courant.
 */
export type ProjectAccess = {
  projectId: string;
  ownerId: string;
  isOwner: boolean;
  isMember: boolean;
  isAdmin: boolean;
  /** Peut ajouter/retirer des collaborateurs : propriétaire ou admin. */
  canManage: boolean;
};

/**
 * Résout l'accès de `currentUserId` au projet. Renvoie `null` si le projet
 * n'existe pas ou si l'utilisateur n'y a aucun droit (ni propriétaire, ni
 * membre, ni admin).
 */
export async function resolveProjectAccess(
  currentUserId: string,
  projectId: string
): Promise<ProjectAccess | null> {
  const [project] = await db
    .select({ ownerId: projects.userId })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!project) return null;

  const isOwner = project.ownerId === currentUserId;

  let isMember = false;
  let isAdmin = false;
  if (!isOwner) {
    const [[member], [u]] = await Promise.all([
      db
        .select({ id: projectMembers.id })
        .from(projectMembers)
        .where(
          and(
            eq(projectMembers.projectId, projectId),
            eq(projectMembers.userId, currentUserId)
          )
        )
        .limit(1),
      db
        .select({ role: users.role })
        .from(users)
        .where(eq(users.id, currentUserId))
        .limit(1),
    ]);
    isMember = Boolean(member);
    isAdmin = u?.role === "admin";
  }

  if (!isOwner && !isMember && !isAdmin) return null;

  return {
    projectId,
    ownerId: project.ownerId,
    isOwner,
    isMember,
    isAdmin,
    canManage: isOwner || isAdmin,
  };
}

/**
 * IDs des projets accessibles à un utilisateur : ceux qu'il possède + ceux qui
 * lui sont partagés. (N'inclut pas « tous les projets » pour un admin, afin de
 * ne pas noyer sa liste — un admin accède aux autres projets par lien direct.)
 */
export async function listAccessibleProjectIds(
  userId: string
): Promise<{ owned: string[]; member: string[] }> {
  const [owned, member] = await Promise.all([
    db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.userId, userId)),
    db
      .select({ id: projectMembers.projectId })
      .from(projectMembers)
      .where(eq(projectMembers.userId, userId)),
  ]);
  return {
    owned: owned.map((r) => r.id),
    member: member.map((r) => r.id),
  };
}

/**
 * Un utilisateur peut accéder à un document s'il en est propriétaire, OU si le
 * document est rangé dans le périmètre (sous-arbre du dossier-racine) d'un
 * projet auquel il a accès. Sert au contrôle d'accès des routes documents
 * (preview / file) en contexte collaboratif.
 */
async function folderIsInAccessibleProject(
  userId: string,
  folderId: string
): Promise<boolean> {
  // Remonte la chaîne des dossiers parents (du dossier donné jusqu'à la
  // racine) puis cherche un projet dont le dossier-racine est un de ces
  // ancêtres ; si l'utilisateur a accès à ce projet, l'accès est accordé.
  const folders = await db
    .select({
      id: documentFolders.id,
      parentFolderId: documentFolders.parentFolderId,
    })
    .from(documentFolders);
  const parentById = new Map(folders.map((f) => [f.id, f.parentFolderId]));
  const ancestry = new Set<string>();
  let cur: string | null = folderId;
  while (cur && !ancestry.has(cur)) {
    ancestry.add(cur);
    cur = parentById.get(cur) ?? null;
  }
  if (ancestry.size === 0) return false;

  const owningProjects = await db
    .select({ id: projects.id })
    .from(projects)
    .where(inArray(projects.folderId, Array.from(ancestry)));

  for (const p of owningProjects) {
    const access = await resolveProjectAccess(userId, p.id);
    if (access) return true;
  }
  return false;
}

export async function userCanAccessDocument(
  userId: string,
  documentId: string
): Promise<boolean> {
  const [doc] = await db
    .select({ ownerId: documents.userId, folderId: documents.folderId })
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1);
  if (!doc) return false;
  if (doc.ownerId === userId) return true;
  if (!doc.folderId) return false;
  return folderIsInAccessibleProject(userId, doc.folderId);
}

/**
 * Un utilisateur peut écrire dans un dossier s'il en est propriétaire, ou si
 * le dossier appartient au périmètre d'un projet auquel il a accès (un
 * collaborateur peut déposer un document dans le dossier du projet partagé).
 */
export async function userCanAccessFolder(
  userId: string,
  folderId: string
): Promise<boolean> {
  const [folder] = await db
    .select({ ownerId: documentFolders.userId })
    .from(documentFolders)
    .where(eq(documentFolders.id, folderId))
    .limit(1);
  if (!folder) return false;
  if (folder.ownerId === userId) return true;
  return folderIsInAccessibleProject(userId, folderId);
}

export type CollaboratorView = {
  userId: string;
  name: string;
  email: string;
  addedAt: Date;
};

/**
 * Liste les collaborateurs (membres) d'un projet, avec leur identité. Ne fait
 * AUCUN contrôle d'accès — l'appelant doit l'avoir validé via
 * `resolveProjectAccess`.
 */
export async function listProjectCollaborators(
  projectId: string
): Promise<CollaboratorView[]> {
  const rows = await db
    .select({
      userId: projectMembers.userId,
      name: users.name,
      email: users.email,
      addedAt: projectMembers.createdAt,
    })
    .from(projectMembers)
    .innerJoin(users, eq(users.id, projectMembers.userId))
    .where(eq(projectMembers.projectId, projectId));
  return rows;
}

export type AddableUser = { id: string; name: string; email: string };

/**
 * Comptes du cabinet pouvant être ajoutés comme collaborateurs : tous les
 * utilisateurs actifs sauf le propriétaire et les membres déjà présents.
 */
export async function listAddableUsers(
  projectId: string,
  ownerId: string
): Promise<AddableUser[]> {
  const existing = await db
    .select({ userId: projectMembers.userId })
    .from(projectMembers)
    .where(eq(projectMembers.projectId, projectId));
  const excluded = new Set<string>([ownerId, ...existing.map((r) => r.userId)]);

  const all = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.isActive, true));

  return all.filter((u) => !excluded.has(u.id));
}
