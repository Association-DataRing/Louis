# Rotation des secrets

Procédures de rotation pour les secrets critiques de Louis.

## `ENCRYPTION_KEY`

**Conséquence** : toutes les `provider_keys` et `connector_keys` chiffrées
en DB deviennent illisibles.

**Quand rotater** :
- Soupçon de compromission (leak du fichier `.env`, accès admin compromis)
- Politique périodique (ex. tous les 24 mois)
- Sortie d'un collaborateur ayant eu accès à la clé

### Procédure

Louis v0.1 ne dispose pas d'un script de rotation automatique. Procédure
manuelle :

1. **Avant** la rotation, **prévenir les utilisateurs** : ils devront
   re-saisir leurs clés provider et identifiants connecteur après la
   rotation.
2. Faire un backup chiffré avec une `BACKUP_PASSPHRASE` ≠ `ENCRYPTION_KEY`
   (cf. [`../admin/backups.md`](../admin/backups.md)).
3. Générer la nouvelle clé : `openssl rand -base64 32`
4. Mettre à jour `ENCRYPTION_KEY` dans le `.env` (ou votre gestionnaire de
   secrets).
5. Redémarrer Louis (`docker compose restart` ou `systemctl restart louis`).
6. **Supprimer** toutes les entrées `provider_keys` et `connector_keys`
   en DB (elles sont illisibles avec la nouvelle clé) :
   ```sql
   DELETE FROM provider_keys;
   DELETE FROM connector_keys;
   ```
7. Informer les utilisateurs qu'ils doivent re-saisir leurs clés via
   **Settings → Providers** et **Settings → Connecteurs**.

### Future amélioration v0.2

Script `npm run rotate-encryption-key` qui :
1. Demande l'ancienne et la nouvelle clé
2. Décrypte avec l'ancienne, re-chiffre avec la nouvelle, en transaction
3. Met à jour `.env` automatiquement
4. Zéro re-saisie côté users

## `AUTH_SECRET`

**Conséquence** : toutes les sessions JWT actives sont invalidées
immédiatement. Les utilisateurs doivent se reconnecter.

**Quand rotater** :
- Soupçon de compromission
- Politique périodique (ex. tous les 12 mois)
- Après un incident sécurité

### Procédure

1. Générer : `openssl rand -base64 32`
2. Mettre à jour `AUTH_SECRET` dans `.env` ou le gestionnaire de secrets
3. Redémarrer Louis
4. Les utilisateurs sont automatiquement déconnectés et redirigés vers `/login`

Pas de migration de données nécessaire.

## `BACKUP_PASSPHRASE`

**Conséquence** : les **nouveaux** backups utiliseront la nouvelle
passphrase. **Les anciens backups restent déchiffrables avec l'ancienne** —
gardez l'ancienne passphrase aussi longtemps que vous voulez pouvoir
restaurer ces backups.

### Procédure

1. Générer : `openssl rand -base64 32`
2. Mettre à jour la variable d'environnement utilisée par `scripts/backup.sh`
3. Documenter l'ancienne passphrase dans le gestionnaire de secrets, marquée
   "rétention pour backups antérieurs au YYYY-MM-DD"
4. Pas de redémarrage nécessaire

## Mots de passe utilisateurs

**Conséquence** : seul l'utilisateur concerné est impacté.

Pas de "reset password" UI en v0.1. Procédure manuelle (admin) :

1. Aller sur **Admin → Utilisateurs**
2. Cliquer "Modifier" sur la ligne du user concerné
3. Saisir un nouveau mot de passe initial
4. Communiquer le mot de passe à l'utilisateur hors-bande (Signal, en
   personne, etc.)
5. Inviter l'utilisateur à le changer dès la première connexion

À venir v0.2 : flow "mot de passe oublié" avec email de reset.

## Audit après rotation

Toutes les rotations admin (création / modification / suppression de
comptes) sont tracées dans `audit_log`. Une rotation `ENCRYPTION_KEY` ou
`AUTH_SECRET` n'est PAS tracée dans `audit_log` (ces secrets sont
manipulés hors-app, au niveau OS). Logger ces événements dans le journal
système de l'OS et la documentation interne du cabinet.
