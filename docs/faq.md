# FAQ

## Général

### Louis est-il un substitut à un avocat ?

**Non.** Louis est un outil de productivité pour les professionnels du
droit. Il n'est pas un conseil juridique au sens de la loi 71-1130. Les
réponses qu'il génère doivent être vérifiées par un·e juriste avant
toute utilisation client.

### Qui maintient Louis ?

L'**association DataRing**. Le projet est open-source AGPL-3.0-or-later
et chacun peut le forker, le contribuer, ou le déployer librement chez
soi.

### Combien ça coûte ?

Le logiciel : **gratuit** (AGPL). Les coûts réels :

- **Vos clés API providers** (Mistral, OpenAI, Anthropic, etc.) — facturé
  à l'usage par le provider directement, jamais par DataRing
- **Votre infrastructure** (un serveur Linux pour Louis, Postgres, Redis,
  S3) — votre choix
- **Vos abonnements connecteurs** (Pappers si vous l'utilisez, etc.)

Pour estimer la conso IA : la page **Settings → Coûts & usage** calcule
un coût mensuel basé sur les tarifs publics catalogués.

## Sécurité

### Mes données vont-elles chez DataRing ?

**Non. Jamais.** Louis tourne sur **votre** serveur. Aucun télémétrie,
aucun heartbeat, aucun appel sortant vers DataRing. Vos données restent
dans **votre** Postgres et **votre** stockage S3.

Les seuls appels sortants sont vers :

- Les **providers IA** que vous avez configurés (vos clés)
- Les **connecteurs** que vous avez configurés (vos accès PISTE, Pappers)
- Les **serveurs MCP** que vous avez configurés (si vous en avez)

### Que se passe-t-il si je perds `ENCRYPTION_KEY` ?

Toutes les clés providers et identifiants connecteurs stockés en DB
deviennent illisibles. Les utilisateurs devront les re-saisir.

Les **autres données** (conversations, documents, audit log) restent
lisibles — elles ne sont pas chiffrées en DB (mais le sont en backup via
`BACKUP_PASSPHRASE`).

Procédure de rotation détaillée :
[`security/secret-rotation.md`](./security/secret-rotation.md).

### Et le RGPD ?

Louis est un **outil**, pas un service. Vous êtes responsable de
traitement (RT) de vos propres données quand vous déployez Louis chez
vous. L'association DataRing n'a **aucun rôle** au sens RGPD sur ce que
vous traitez avec votre instance Louis.

Pour les sous-traitants :

- **Vos providers IA** sont des sous-traitants RGPD si vous traitez des
  données personnelles. Vérifiez leur DPA (Mistral, Scaleway, OVH ont des
  DPAs FR ; Anthropic et OpenAI ont des DPAs US/EU)
- **Vos connecteurs** (Pappers, PISTE) sont des sources publiques ou
  semi-publiques, leurs CGU régissent l'usage

## Fonctionnel

### Pourquoi Mistral est-il "recommandé en premier" ?

Parce que Mistral est le seul provider qui fournit aussi les
**embeddings** nécessaires au RAG en v0.1 (`mistral-embed`, vecteurs
de 1024 dimensions). Sans clé Mistral active, vous pouvez chatter avec
n'importe quel provider mais la **recherche sémantique dans vos
documents** est désactivée.

À v0.1.x : support des embeddings OpenAI et Cohere comme alternatives.

### Les sub-APIs Judilibre / JADE / INPI / BODACC sont-elles supportées ?

**Pas encore en v0.1.** Le manifeste les annonce, l'infrastructure PISTE
est en place, mais seul `legifrance_search` est implémenté. Les autres
sub-APIs arriveront en v0.1.x.

Cf. [`feature-status.md`](./feature-status.md) pour l'état précis.

### Puis-je utiliser Louis dans un cabinet sans serveur dédié ?

Techniquement oui : un Mac mini M2 ou équivalent fait largement
l'affaire pour un cabinet de < 20 personnes. Postgres + Redis + Node +
LibreOffice tournent sans peine.

Pour des cabinets plus gros ou avec des contraintes de redondance,
prévoir un serveur dédié (8 GB RAM, 4 CPU, 50 GB SSD minimum) chez un
hébergeur souverain (Scaleway, OVH, Outscale).

### Comment migrer mes données entre instances ?

`pg_dump` + sync S3. Procédure dans
[`admin/backups.md`](./admin/backups.md).

### Y a-t-il une version SaaS hébergée ?

**Non, intentionnellement.** Louis est conçu pour l'auto-hébergement.
DataRing pourrait techniquement héberger une instance Louis publique,
mais cela violerait le manifeste ("vos données, chez vous").

Si vous voulez l'essayer rapidement : `git clone && docker compose up &&
npm run demo` (10 min sur un Mac).

## Contribuer

### Puis-je contribuer ?

Oui — voir [`../CONTRIBUTING.md`](../CONTRIBUTING.md). Les contributions
externes seront formellement ouvertes autour de v0.2. D'ici là, les
**issues** (bugs, idées de connecteurs, cas d'usage) sont les bienvenues.

### Quelle est la différence avec Mike OSS ?

Mike (https://github.com/willchen96/mike) est un projet open-source
similaire, également AGPL-3.0. Louis :

- est en français, conçu pour le droit français
- bundle les connecteurs français (PISTE, Pappers)
- met en avant la souveraineté (badges FR/UE/US par provider)
- est sur stack Next.js 16 + Server Components (Mike est sur une autre
  stack)
- est porté par l'association DataRing

Cf. [`../THIRD_PARTY/NOTICE.md`](../THIRD_PARTY/NOTICE.md) pour les
crédits.
