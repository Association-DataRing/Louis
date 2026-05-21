# Gestion des utilisateurs

Réservé aux administrateurs (rôle `admin`).

## Accès

**Admin → Utilisateurs** (`/admin/users`) — visible uniquement pour les
comptes admin.

## Actions disponibles

### Créer un compte

- Bouton "Nouvel utilisateur"
- Champs : email, nom, mot de passe initial, rôle (admin / member)
- Le mot de passe initial doit être communiqué hors-bande et changé à la
  première connexion

### Désactiver / Réactiver

- `Désactiver` : l'utilisateur ne peut plus se connecter. Ses données
  (conversations, documents) restent intactes.
- `Réactiver` : restaure l'accès, aucune perte.

### Changer le rôle

- `member` → `admin` ou inversement
- Au moins un compte admin actif est requis en permanence — la
  désactivation/suppression du dernier admin est bloquée côté backend

### Supprimer

⚠️ **Action destructive et irréversible.** Supprime le compte ET ses
données (conversations, documents, provider keys, tabular reviews,
workflows). Une confirmation est demandée.

## Journal d'audit

Chaque action ci-dessus est enregistrée dans `audit_log` (`/admin/audit`)
avec l'admin acteur, la cible, et la date. Append-only.

## Bonnes pratiques

- **Ne jamais partager un compte** — toute action est attribuée à un
  utilisateur unique pour la traçabilité juridique
- **Comptes nominatifs** — pas de "compte secrétariat" partagé : chaque
  collaborateur du cabinet a son propre login
- **Rotation des admin** : un seul admin = SPOF. Avoir au moins 2 admin
  actifs
- **Désactiver plutôt que supprimer** quand un collaborateur quitte le
  cabinet : ses dossiers restent accessibles aux autres admin si besoin
  d'audit ultérieur

## Création d'un premier admin

Un admin initial est créé via `npm run db:seed` (ou `npm run demo` pour
l'install démo). Voir [`../installation/docker-compose.md`](../installation/docker-compose.md).
