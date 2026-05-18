# Politique de sécurité

Louis manipule des secrets sensibles (clés API providers, identifiants
PISTE/Pappers, mots de passe utilisateurs) et est destiné à un environnement
de travail juridique soumis au secret professionnel. Les questions de
sécurité sont prioritaires.

## Périmètre du support

| Branche | Statut | Mises à jour de sécurité |
|---|---|---|
| `0.1.x` (alpha en cours) | ✅ active | jusqu'à publication de `0.2` |
| Branches antérieures (pré-v0.1) | ❌ non maintenues | — |

Une fois `v1.0` publiée, la N-1 sera maintenue 12 mois après la sortie de
la N. Pour les déploiements en production, suivre `main` ou la dernière
release stable.

## Software Bill of Materials (SBOM)

Chaque GitHub Release inclut un SBOM **CycloneDX 1.x** (`louis-sbom-vX.Y.Z.cdx.json`)
listant l'ensemble des dépendances de production avec versions, hashes
et licences. Vous pouvez aussi le régénérer localement :

```bash
npm ci --omit=dev
npm run sbom         # → sbom.cdx.json
```

Le SBOM peut être consommé par tout scanner compatible CycloneDX (Trivy,
Grype, Dependency-Track, Snyk) pour cartographier la chaîne
d'approvisionnement et corréler aux CVE publiées.

## Coordination avec les autorités

Conformément à l'**EU Cyber Resilience Act** (Règlement UE 2024/2847,
Article 14), une vulnérabilité activement exploitée affectant Louis fera
l'objet d'un signalement coordonné à :

- **ENISA** (signalement initial 24h, intermédiaire 72h, final 14 jours)
- **CSIRT-FR** (l'autorité nationale française désignée)

La politique de signalement complète et le mapping détaillé des
exigences CRA → mesures Louis sont décrits dans
[`docs/security/cra-compliance.md`](../docs/security/cra-compliance.md).

## Signaler une vulnérabilité

**Ne créez pas d'issue publique.**

Envoyez un email à **security@data-ring.net** avec :

- la description de la vulnérabilité
- les étapes pour la reproduire
- l'impact potentiel (lecture de secrets, élévation de privilèges, RCE, …)
- votre identité (optionnelle, mais utile pour vous créditer)

Vous recevrez une première réponse sous **72 heures ouvrées**.

## Notre engagement

- Coordonner avec vous un calendrier de divulgation responsable.
- Publier un correctif dans une release dédiée (`vX.Y.Z+security`).
- Vous créditer publiquement dans le `CHANGELOG.md` (sauf demande contraire).

## Modèle de sécurité

Louis suppose les invariants suivants :

1. **Confiance dans l'utilisateur authentifié** : un user authentifié est
   considéré comme légitime pour les ressources scopées à son `userId`.
   Aucun share entre comptes en v0.1.
2. **Confiance dans l'admin** : un admin a accès à tous les comptes, peut
   désactiver/supprimer des users, et modifier la configuration du
   cabinet. Pas de scope sub-admin en v0.1.
3. **Confiance dans le déployeur** : l'admin de l'instance a accès à
   l'ENCRYPTION_KEY et donc, en théorie, à toutes les clés provider
   stockées. C'est inhérent au modèle BYOK self-hosted — chacun chez soi.
4. **Pas de multi-tenancy logique** : un déploiement = un cabinet. Pour
   plusieurs cabinets, prévoir plusieurs déploiements isolés (DB
   différentes, ENCRYPTION_KEY différentes).

## Mesures de défense en place (v0.1)

### Crypto

- **Provider keys** : chiffrement AES-256-GCM, IV 12 octets random par
  ciphertext, tag d'authentification 16 octets. Clé dérivée de
  `ENCRYPTION_KEY` via scryptSync (cachée au premier accès).
- **Mots de passe utilisateurs** : bcrypt cost 12.
- **Sessions** : JWT NextAuth v5, secret `AUTH_SECRET`.

### Rate-limiting

Rate-limit Redis fenêtre fixe sur :

| Endpoint | Identifiant | Limite par défaut | Variable env |
|---|---|---|---|
| `POST /api/chat` | user authentifié | 30 / min | `RATE_LIMIT_CHAT_PER_MINUTE` |
| `POST /api/documents/upload` | user authentifié | 60 / h | `RATE_LIMIT_UPLOAD_PER_HOUR` |
| Login (action `loginAction`) | IP | 10 / 15 min | `RATE_LIMIT_LOGIN_PER_15MIN` |

Comportement en cas de panne Redis : **fail-open** (autorisé) avec warning
loggué. Justification : un cabinet ne doit pas se retrouver bloqué pendant
une consultation client à cause d'une panne d'infra. Si vous voulez
fail-closed pour la prod, adaptez `src/lib/rate-limit.ts`.

### Headers HTTP

Appliqués par `src/middleware.ts` sur toutes les réponses :

- `Content-Security-Policy` (permissive sur les inline scripts en v0.1, durcissement prévu v0.1.x via nonces)
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY` + `frame-ancestors 'none'`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` minimal (camera, microphone, geolocation, FLoC désactivés)
- `Strict-Transport-Security` (production uniquement) : 1 an, includeSubDomains, preload

### Audit log

Table `audit_log` append-only. Actions tracées :

- `auth.login` / `auth.login.failed` (avec raison : unknown / inactive / bad_password)
- `user.create` / `user.update` / `user.disable` / `user.enable` / `user.delete` / `user.role`
- `provider.add` / `provider.delete` / `provider.toggle`
- `connector.add` / `connector.delete`
- `doc.delete`
- `cabinet.update`

Accessible à l'admin via `/admin/audit` (200 dernières entrées).

## Hors-scope (pas considéré vulnérabilité)

- Exécution arbitraire via une clé API que l'utilisateur a lui-même fournie
  à son propre déploiement (l'utilisateur est admin de son instance).
- Comportements résultant d'une configuration `ENCRYPTION_KEY` faible ou
  partagée publiquement.
- DoS volumétrique au-delà du rate-limit configuré (à dimensionner via les
  variables `RATE_LIMIT_*`).
- Failles dans les providers IA tiers (à signaler directement chez eux).

## Bonnes pratiques côté admin

Lors du déploiement de Louis, en production :

### Secrets

- **`ENCRYPTION_KEY`** : générée par `openssl rand -base64 32` (256 bits
  d'entropie). **Jamais** un mot de passe humain : la sécurité du
  chiffrement des provider keys en dépend directement. Sa rotation
  invalide toutes les clés stockées.
- **`AUTH_SECRET`** : idem (`openssl rand -base64 32`), ne JAMAIS la
  partager entre environnements.
- Stockage des secrets : en prod, utiliser un gestionnaire (Vault, AWS
  Secrets Manager, Scaleway Secret Manager, OVH KMS) plutôt qu'un fichier
  `.env` posé à plat sur le serveur.

### Base de données

- **`DATABASE_URL`** : sur le réseau privé uniquement.
- **SSL** : poser `DATABASE_SSL=true` + `DATABASE_SSL_REJECT_UNAUTHORIZED=true`
  (défaut) en prod. Le `rejectUnauthorized=false` n'est acceptable que
  pour un Postgres self-hosted avec cert auto-signé après évaluation MITM.
- **Rôles** : créer un user Postgres dédié à Louis avec les seules
  permissions sur sa base. Pas de `postgres` superuser.
- **Sauvegardes** : chiffrées au repos, **chiffrées indépendamment de
  `ENCRYPTION_KEY`** (autrement la rotation casserait l'ancien backup).

### Réseau

- **Reverse-proxy** : HTTPS obligatoire (Caddy, Nginx, Traefik).
- **HSTS** : automatique sur les réponses du middleware en `NODE_ENV=production`.
- **Forwarded headers** : configurer le reverse-proxy pour poser
  `X-Forwarded-For` et `X-Real-IP` correctement — sinon le rate-limit
  login dégénère en compteur global.

### Monitoring

- Surveiller les warnings `[rate-limit]` (Redis indisponible).
- Surveiller les warnings `[audit]` (échec d'insertion dans audit_log).
- Page `/admin/audit` à inspecter régulièrement pour détecter les patterns
  anormaux (multiples `auth.login.failed`, suppressions de comptes, etc.).

## Vulnérabilités connues

Les vulnérabilités corrigées sont documentées :

- dans la section sécurité de chaque release du `CHANGELOG.md`
- via les **GitHub Security Advisories** publiés sur ce dépôt
  (onglet Security → Advisories) pour les vulnérabilités sévères
- via un identifiant CVE le cas échéant (réservé via GHSA pour les
  CVSS ≥ 7.0)
