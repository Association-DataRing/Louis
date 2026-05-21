# Gérer les documents

## Upload

**Documents → Uploader** (ou Cmd+K → "Uploader").

- Formats supportés : **PDF, DOCX, texte brut**
- Taille max : **25 Mo**
- Extraction texte serveur jusqu'à **500 000 caractères**
- Si plus long : statut `truncated`, le texte est tronqué proprement

Pendant l'upload, Louis :

1. Stocke le binaire dans S3
2. Extrait le texte (pdf-parse / mammoth / texte direct)
3. Découpe en chunks ~1k tokens
4. Embedde avec Mistral (si clé active)
5. Insert dans `document_chunks` pour le RAG

Si pas de clé Mistral active : statut `no_mistral_key`, le document est
stocké et lisible, mais pas indexé en RAG (vous pouvez toujours le joindre
au chat via le trombone — son texte ira dans le system prompt).

## Hiérarchie de dossiers

Cliquer "Nouveau dossier" pour créer une arborescence :

- Profondeur illimitée (sous-dossier de sous-dossier...)
- Renommage / déplacement supportés
- Breadcrumb au top : `Documents > Contrats > 2026 > Client X`

## Versions

Cliquer **⋮** sur un document → "Uploader nouvelle version".

- Le nouveau fichier devient `v2` (puis `v3`, ...)
- Le `parentDocumentId` pointe vers la racine de la famille
- La vue **Documents** groupe la famille en une seule ligne (latest
  affichée, anciennes en accordéon repliable)
- Le projet d'origine est conservé d'une version à l'autre

## Projets

Conteneurs "dossier client". Créer via **Projets → Nouveau projet**.

- Move-to-project depuis chat, conversation ou document : `⋮ → Déplacer
  vers projet`
- Quand vous êtes dans une conversation rattachée à un projet, le
  breadcrumb projet apparaît en haut du chat avec un dot bleu

## Aperçu (DocPanel)

Cliquer un document → DocPanel à droite. Trois modes :

1. **PDF natif** (uploads PDF) — rendu via react-pdf, navigation page par
   page, sans la toolbar pdf.js parasite
2. **DOCX rendu Gotenberg** (documents générés par Louis) — vraie
   pagination A4 fidèle à Word
3. **DOCX rendu mammoth** (uploads DOCX users) — preview HTML
   suffisamment fidèle aux mises en forme Word/Pages

Le bouton **Télécharger** (↓) renvoie le fichier original (PDF ou DOCX).

## Tools du chat sur les documents

Quand vous discutez avec un document, le modèle peut appeler :

- `search_documents` : recherche sémantique dans **tous** vos documents
  (pas seulement celui joint)
- `read_document` : lit le texte complet d'un document précis (UUID)
- `find_in_document` : cherche une chaîne dans un document précis
- `generate_document` : génère un DOCX (avec PDF preview)
- `edit_document` : applique des édits trackés sur un DOCX existant

## Suppression

⚠️ **Action irréversible.** Supprime aussi le binaire S3 et les chunks
RAG. Enregistré dans le journal d'audit (`doc.delete`).

Préfère le **renommer / déplacer** quand possible.
