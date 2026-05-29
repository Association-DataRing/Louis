# Prise en main

Ce guide vous fait passer d'une instance Louis vide à votre première
conversation utile, en cinq étapes. Comptez **5 à 10 minutes**.

> Vous découvrez Louis sans l'avoir installé ? L'installation (Docker,
> base de données, secrets) est côté administrateur : voir
> [Installation](../installation/docker-compose.md). Ce guide suppose une
> instance déjà en ligne et un compte créé pour vous.

## Le principe en une phrase

Louis n'embarque **aucune clé** ni **aucun connecteur** par défaut. Vous
branchez les vôtres : vos clés IA restent chez vous, vos données restent
sur votre infrastructure. C'est le sens du « Bring Your Own Key ».

## Étape 1 — Connecter une clé provider IA (obligatoire)

Sans au moins une clé provider active, le chat ne peut pas répondre.

1. Ouvrez **Paramètres → Providers** (`/settings/providers`)
2. Cliquez **Ajouter une clé**, choisissez un provider, collez la clé
3. Activez la clé (toggle **Actif**), puis testez la connexion

**Commencez par Mistral** (🇫🇷) : c'est le seul provider qui fournit aussi
les *embeddings* nécessaires à la recherche sémantique dans vos documents
(RAG) en v0.1. Sans clé Mistral active, le chat fonctionne mais la
recherche dans vos documents est limitée.

→ Détail de chaque provider (souverains FR/UE, international, self-hosted) :
[Configuration des providers](../configuration/providers.md).

## Étape 2 — Connecter vos sources juridiques (optionnel)

Pour que Louis interroge des sources de droit officielles pendant une
conversation :

- **PISTE** (DILA) — donne accès à **Légifrance**. Inscription sur
  [piste.gouv.fr](https://piste.gouv.fr/), puis **Paramètres →
  Connecteurs**.
- **Pappers** — base entreprises (SIREN, dirigeants, bénéficiaires
  effectifs). Clé sur [pappers.fr/api](https://www.pappers.fr/api).

> Couverture réelle en v0.1 : **Légifrance** et **Pappers** sont
> fonctionnels. Judilibre, JADE, INPI et BODACC sont prévus mais pas
> encore implémentés — voir [État des fonctionnalités](../feature-status.md).

→ Pas à pas et tests : [Configuration des connecteurs](../configuration/connectors.md).

## Étape 3 — Lancer une première conversation

1. Allez sur **Conversations** (`/chat`)
2. Choisissez un provider et un modèle dans le sélecteur (le badge
   FR / UE / US reste visible pendant toute la conversation)
3. Tapez votre question, `Entrée` pour envoyer

Si Louis appelle un outil (recherche Légifrance, lecture d'un document…),
une pastille cliquable apparaît dans la réponse : cliquez-la pour voir
exactement ce que le modèle a reçu et renvoyé.

→ Tout le chat (joindre des documents, workflows, export) :
[Utiliser le chat](./chat.md).

## Étape 4 — Importer un document

1. **Documents → Uploader** (PDF, DOCX ou texte, ≤ 25 Mo)
2. Une fois importé, joignez-le à une conversation via l'icône trombone,
   ou laissez Louis le retrouver par recherche sémantique

Avec une clé Mistral active, le document est découpé et indexé pour le
RAG. Sans, il reste consultable et joignable (son texte va alors dans le
contexte du message).

→ Dossiers, versions, aperçu : [Gérer les documents](./documents.md).

## Étape 5 — Organiser un dossier client en projet

Un **projet** regroupe les conversations et les documents d'un même
dossier, et **restreint le RAG à ce périmètre** : l'IA ne raisonne que
sur les pièces et échanges du projet.

1. **Projets → Nouveau projet**
2. Rattachez-le à un dossier de documents (nouveau ou existant)
3. Déplacez-y vos conversations et documents via `⋮ → Déplacer vers projet`

→ Détail du fonctionnement : [Travailler par projet](./projects.md).

## Et après ?

- **Workflows** — des prompts cabinet réutilisables (résumé d'arrêt,
  analyse de clause…) insérables en un clic dans le chat.
- **Serveurs MCP** — branchez n'importe quel outil métier (base de
  précédents, ERP, signature) via le Model Context Protocol :
  [Connecteurs → MCP](../configuration/connectors.md).
- **Coûts & usage** — suivez la dépense estimée par conversation et au
  global dans **Paramètres → Coûts & usage**.
- **Administration** (si vous êtes admin) — comptes, journal d'audit,
  sauvegardes : [Guide admin](../admin/users.md).
