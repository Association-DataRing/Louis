# Utiliser le chat

## Premier message

1. Cliquer **Nouvelle conversation** (ou `Cmd+K` → "Nouvelle conversation")
2. Choisir un provider et un modèle dans le sélecteur en haut
3. Optionnel : joindre un ou plusieurs documents via le trombone 📎
4. Optionnel : insérer un workflow via l'éclair ⚡
5. Taper la question, `Entrée` pour envoyer (`Shift+Entrée` pour nouvelle ligne)

La réponse arrive en streaming. Le DocPanel s'ouvre automatiquement à
droite si le modèle a généré ou édité un document.

## Multi-conversation

- **Sidebar à gauche** : liste vos conversations, triées par date
  (épinglées en premier)
- **Cmd+F dans la sidebar** : recherche locale rapide
- **Bouton "Épingler"** (icône Pin) sur chaque conversation : la place en
  haut de la liste

## Joindre des documents

Le trombone du composer ouvre un sélecteur. Cocher un ou plusieurs
documents → leur texte extrait est injecté dans le system prompt **pour
ce message uniquement**. Si le modèle a besoin d'eux pour les messages
suivants, re-cocher.

Différence avec le RAG (`search_documents`) :

- **Joindre** : le texte complet du document va dans le contexte. Bon
  pour les petits docs (< 50k chars). Le modèle voit TOUT.
- **RAG** : le modèle appelle `search_documents` avec une requête, et
  Louis ressort les chunks pertinents. Bon pour les gros volumes ou
  quand vous voulez chercher sans préciser quel doc.

Les deux peuvent coexister dans une conversation.

## Workflows

Bibliothèque de prompts cabinet réutilisables. Cliquer l'éclair ⚡ →
sélectionner → le prompt est inséré dans le composer (vous pouvez
toujours l'éditer avant envoi).

5 workflows par défaut :
- **Résumé d'arrêt** : 5 sections, citations entre guillemets
- **Analyse de clause** : 4 axes (objet, obligations, risques, réécriture)
- **Comparaison de contrats** : tableau N-dimensions
- **Due diligence rapide** : profil juridique d'entreprise (utilise
  Pappers + Légifrance si configurés)
- **Note de synthèse** : note interne 1 page, ton sobre

Créez les vôtres via **Workflows** dans le menu.

## Tools (appels d'outils par le modèle)

Quand vous voyez une pill cliquable dans la réponse (icône d'outil), c'est
que le modèle a appelé un tool :

- 🔍 `search_documents` : recherche sémantique RAG dans vos documents
- 📄 `read_document` : lit le texte complet d'un document précis
- 🔎 `find_in_document` : cherche une chaîne dans un document précis
- 🇫🇷 `legifrance_search` : recherche dans Légifrance (via PISTE)
- 🏢 `pappers_search` / `pappers_get` : entreprises françaises
- 📝 `generate_document` : génère un DOCX + preview PDF
- ✏️ `edit_document` : propose des édits trackés sur un DOCX
- 🧩 `mcp__<server>__<tool>` : appel à un serveur MCP que vous avez configuré

Cliquer la pill → modal avec input et output du tool. Utile pour
comprendre ce que le modèle a vu / récupéré.

## Edits inline (`::before / ::after / ::reason`)

Quand vous demandez une reformulation rapide ("réécris-moi cette
clause"), le modèle peut renvoyer un bloc Markdown spécial qui apparaît
comme une **EditCard** : original à gauche, proposé à droite, raison en
dessous. Pratique pour les corrections ponctuelles.

(Le flow "apply to source document" sera complet en v0.1.x.)

## Export

- **Markdown** : icône télécharger en haut → fichier `.md` avec
  l'historique complet
- **PDF** : `Cmd+P` ou l'icône PDF → ouvre `/print/chat/<id>` qui
  déclenche l'impression navigateur. Adapté pour archiver une
  conversation en PDF (footer cabinet auto, pagination A4)

## Suivi des coûts

Le pill en haut à droite affiche le coût estimé de la conversation en
cours (basé sur les tarifs publics au catalogue, cf.
[`../configuration/providers.md`](../configuration/providers.md)).

Pour l'usage global : **Settings → Coûts & usage**.
