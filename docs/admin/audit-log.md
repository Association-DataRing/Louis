# Journal d'audit

Append-only. Visible sur **`/admin/audit`** (les 200 dernières entrées).

## Actions tracées (v0.1)

| Action | Déclencheur | Métadonnées |
|---|---|---|
| `auth.login` | Connexion réussie | acteur, email |
| `auth.login.failed` | Échec de connexion | email, reason : `unknown` / `inactive` / `bad_password` |
| `user.create` | Création de compte admin | acteur, email cible |
| `user.update` | Modification de profil | acteur, cible |
| `user.disable` / `user.enable` | Désactivation / réactivation | acteur, cible |
| `user.delete` | Suppression de compte | acteur, cible |
| `user.role` | Changement de rôle | acteur, cible, nouveau rôle |
| `provider.add` | Ajout d'une clé provider | acteur, `type:label` |
| `provider.delete` | Suppression d'une clé provider | acteur, `type:label` |
| `provider.toggle` | Activation / désactivation | acteur, `type:label`, nouvel état |
| `connector.add` | Ajout d'un connecteur (PISTE / Pappers) | acteur, `type:label` |
| `connector.delete` | Suppression d'un connecteur | acteur, `type:label` |
| `doc.delete` | Suppression d'un document | acteur, filename |
| `cabinet.update` | Modification de la config cabinet (nom, footer, mention légale) | acteur |

## Schéma de la table

Voir [`../../src/db/schema/audit-log.ts`](../../src/db/schema/audit-log.ts).

Colonnes : `id`, `userId` (acteur, nullable pour les events système),
`action` (kebab-case namespacé), `target` (la ressource), `meta` (jsonb),
`createdAt`.

## Rétention

Pas de purge automatique en v0.1. Si vous voulez limiter la croissance,
ajouter un cron Postgres :

```sql
-- À adapter à votre politique (90 jours dans cet exemple)
DELETE FROM audit_log WHERE created_at < NOW() - INTERVAL '90 days';
```

## Failure mode

Si l'insertion dans `audit_log` échoue (DB momentanément down, schéma
obsolète), `recordAudit` log un warning JSON et **ne propage pas l'erreur**.
L'action fonctionnelle (ex: suppression d'un user) continue. C'est un
choix de design : un crash d'audit ne doit pas bloquer une action
légitime, mais l'admin doit voir le warning dans son monitoring.

Surveiller dans les logs : `{"level":"warn","scope":"audit",...}`.
