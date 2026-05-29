# Travailler par projet

Un **projet** est un dossier client : il regroupe des conversations et des
documents, et **restreint le raisonnement de l'IA à ce périmètre**. C'est
le bon réflexe dès qu'un dossier prend de l'ampleur.

## Ce qu'un projet change concrètement

Quand vous discutez **dans le contexte d'un projet**, Louis ne prend en
compte que :

- les **documents** rangés dans le dossier du projet (et ses
  sous-dossiers, récursivement) ;
- l'**historique des autres conversations** du même projet.

Autrement dit, les outils documentaires (`search_documents`,
`read_document`…) et la recherche d'historique sont **scopés** au projet —
pas de fuite vers les autres dossiers du cabinet, et pas de bruit venu
d'affaires sans rapport. Un document généré dans une conversation de
projet atterrit directement dans le dossier du projet.

> Mental model : un projet = un espace de connaissance fermé (ses pièces
> + ses échanges), à la manière d'un NotebookLM ou d'un Projet Claude —
> pas une recherche globale sur tout le cabinet.

## Créer un projet

1. **Projets → Nouveau projet**
2. Donnez-lui un nom (ex. « Dupont c/ Martin »)
3. Choisissez son **emplacement de stockage** :
   - **Nouveau dossier** (pré-rempli au nom du projet), ou
   - **Dossier existant** dans votre arborescence `/documents`

Un projet a **toujours** un dossier de stockage : c'est lui qui définit
quels documents appartiennent au projet.

## Rattacher conversations et documents

Depuis une conversation, une entrée de la sidebar ou un document :

> `⋮ → Déplacer vers projet`

- Une **conversation** déplacée vers un projet voit son contexte RAG se
  restreindre au projet. Un breadcrumb projet (avec un point bleu)
  apparaît en haut du chat.
- Un **document** déplacé est rangé dans le dossier du projet — il entre
  donc dans le périmètre RAG du projet.

## Démarrer une conversation déjà dans un projet

Depuis la page d'un projet, lancez une nouvelle conversation : elle est
créée d'emblée rattachée au projet, avec le périmètre RAG correspondant.

## Bon à savoir

- **Sans document dans le projet**, les outils de recherche renvoient
  simplement « rien trouvé » plutôt que de retomber sur tous vos
  documents — c'est volontaire, pour éviter toute fuite inter-projets.
- L'indexation de l'historique des conversations (pour la recherche
  croisée intra-projet) nécessite une **clé Mistral active**. Sans elle,
  l'indexation est ignorée silencieusement.
- Hors projet, le comportement historique reste inchangé : l'IA voit
  l'ensemble de vos documents.

→ Pour gérer les fichiers eux-mêmes (dossiers, versions, aperçu) :
[Gérer les documents](./documents.md).
