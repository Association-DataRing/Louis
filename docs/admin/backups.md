# Sauvegarde et restauration

Louis stocke trois types de données critiques :

1. **Postgres** : utilisateurs, conversations, messages, provider keys
   chiffrées, connecteurs, audit log, workflows, projets, etc.
2. **Object storage (S3-compatible)** : binaires des documents uploadés
   (PDF, DOCX, texte) + PDFs preview générés
3. **`ENCRYPTION_KEY` et `AUTH_SECRET`** : si perdues, toutes les clés
   provider stockées deviennent inutilisables, et toutes les sessions JWT
   sont invalidées

Une stratégie de backup robuste couvre les trois.

## Postgres

Le script [`../../scripts/backup.sh`](../../scripts/backup.sh) fait :

```bash
pg_dump $DATABASE_URL → louis-TIMESTAMP.sql
gpg --symmetric --cipher-algo AES256 → louis-TIMESTAMP.sql.gpg
shred le dump en clair
```

Variables requises :

- `DATABASE_URL` : la chaîne de connexion
- `BACKUP_PASSPHRASE` : **différente** de `ENCRYPTION_KEY` (cf. ci-dessous)
- `BACKUP_DIR` (optionnel) : dossier de destination (défaut `./backups`)

### Pourquoi une passphrase distincte d'`ENCRYPTION_KEY` ?

Si vous rotez `ENCRYPTION_KEY` (typiquement parce qu'elle a fuité ou pour
respecter une politique), Louis re-chiffre toutes les provider keys en DB
avec la nouvelle. **L'ancien backup, chiffré avec l'ancienne `ENCRYPTION_KEY`,
contient les anciennes clés re-chiffrées**. Donc :

- Si vous utilisez `ENCRYPTION_KEY` comme passphrase de backup, la
  rotation rend l'ancien backup inrestaurable (vous n'avez plus l'ancienne
  clé)
- Avec une `BACKUP_PASSPHRASE` indépendante, vous pouvez restaurer un
  ancien backup, puis re-chiffrer les provider keys avec la nouvelle
  `ENCRYPTION_KEY`

### Cron exemple

```cron
# Toutes les nuits à 03:00 (heure serveur)
0 3 * * * cd /opt/louis && BACKUP_PASSPHRASE="$(cat /etc/louis/backup-passphrase)" ./scripts/backup.sh
```

### Restauration

```bash
gpg --decrypt louis-2026-05-16T03-00-00Z.sql.gpg | psql $DATABASE_URL
```

## Object storage

Pas de script intégré — utilisez `rclone`, `aws-cli sync`, ou les outils
natifs de votre provider :

```bash
# Exemple rclone vers un second bucket / un disque local chiffré
rclone sync louis-storage:/ /backup/storage-2026-05-16/
```

Une bonne pratique : **différer** la rétention DB et stockage (ex. DB
gardée 30 jours, storage 90 jours) pour pouvoir restaurer un état cohérent
des deux à tout moment.

## Secrets

`ENCRYPTION_KEY`, `AUTH_SECRET`, `BACKUP_PASSPHRASE` : stocker dans un
gestionnaire de secrets (Vault, AWS Secrets Manager, Scaleway Secret
Manager, OVH KMS, 1Password Business, Bitwarden Business). **JAMAIS** dans
le repo, JAMAIS dans le backup non chiffré.

En cas de perte d'`ENCRYPTION_KEY` : les conversations / documents
restent lisibles (pas chiffrés en DB), mais **toutes les provider keys et
connecteurs deviennent inutilisables**. Les utilisateurs devront
re-saisir leurs clés.

## Test de restauration

Tester votre backup **avant** d'en avoir besoin. Une fois par trimestre
au moins :

1. Cloner Louis dans un dossier de staging
2. Restaurer un dump récent
3. Configurer une `ENCRYPTION_KEY` test
4. Tenter de lister les utilisateurs, les conversations, et un document
5. Confirmer que la décompression et l'authentification fonctionnent
