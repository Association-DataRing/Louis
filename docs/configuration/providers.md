# Configuration des providers IA

Louis fonctionne en **Bring Your Own Key** : chaque utilisateur (ou
l'administrateur, pour un compte partagé) configure ses propres clés
provider. Aucune clé n'est partagée par défaut, aucun appel IA ne transite
par un serveur Louis tiers.

Toutes les clés sont chiffrées AES-256-GCM avec `ENCRYPTION_KEY` avant
stockage.

## Workflow général

1. Aller sur **Settings → Providers**
2. Cliquer "Ajouter une clé"
3. Choisir le type (Mistral, OpenAI, etc.)
4. Coller la clé API
5. Optionnel : tester la connexion via le bouton "Tester"
6. Activer la clé (toggle "Actif")
7. Optionnel : marquer comme "Par défaut" pour ce type de provider

## Providers supportés

### Mistral (recommandé en premier)

- **Source** : https://console.mistral.ai/
- **Souveraineté** : 🇫🇷 France
- **Utilisé pour** : chat + **embeddings RAG** (`mistral-embed`)
- **Note importante** : Mistral est le seul provider qui fournit aussi les
  embeddings nécessaires au RAG en v0.1. Sans clé Mistral active, la
  recherche sémantique dans vos documents est désactivée (le chat avec
  documents fonctionne via injection system-prompt comme fallback, mais
  c'est limité aux petits volumes).

### Scaleway Generative APIs

- **Source** : https://console.scaleway.com/ → IAM → API Keys → Generative APIs
- **Souveraineté** : 🇫🇷 France
- **Modèles disponibles** : Llama 3.x, Mistral, Pixtral, etc.
- **Protocole** : OpenAI-compatible (Louis route via `api.scaleway.ai/v1`)

### OVHcloud AI Endpoints

- **Source** : https://endpoints.ai.cloud.ovh.net/
- **Souveraineté** : 🇫🇷 France
- **Particularité** : URL par modèle. Renseigner `baseUrl` si Louis ne
  reconnaît pas votre modèle (ex. `https://mixtral-8x7b-instruct.endpoints.kepler.ai.cloud.ovh.net/api/openai_compat/v1`)

### Albert (Etalab)

- **Source** : https://albert.api.etalab.gouv.fr/
- **Souveraineté** : 🇫🇷 France (Direction interministérielle du numérique)
- **Note** : modèles fournis par l'État français, dimensionnés pour des
  usages d'administration. Compte requis.

### Anthropic Claude

- **Source** : https://console.anthropic.com/
- **Souveraineté** : 🇺🇸 États-Unis (badge US affiché)
- **Recommandation** : pour les tâches juridiques fines (rédaction
  d'avenants, analyses complexes), Claude Sonnet 4.x est excellent. Le
  badge US permet à l'utilisateur de garder la main sur ce qui transite.

### OpenAI

- **Source** : https://platform.openai.com/
- **Souveraineté** : 🇺🇸 États-Unis (badge US affiché)
- **Modèles** : GPT-5.x, GPT-4o, etc.

### Endpoint OpenAI-compatible générique

Pour brancher :

- **Ollama** : `OPENAI_COMPATIBLE_BASE_URL=http://localhost:11434/v1`
- **vLLM** auto-hébergé : `https://votre-serveur/v1`
- **llama.cpp** server : `http://localhost:8080/v1`

Souveraineté = 🏠 Self-hosted dans l'UI Louis.

## Coûts

La page **Settings → Coûts & usage** affiche les coûts estimés mensuels +
all-time, à partir du catalogue de prix dans
[`src/lib/providers/pricing.ts`](../../src/lib/providers/pricing.ts). Les
modèles auto-hébergés (Albert, Ollama, openai_compatible) sont comptés à 0
— l'infrastructure est facturée séparément.

## Rotation d'une clé

1. Aller sur **Settings → Providers**
2. Cliquer "Modifier" sur la clé concernée
3. Coller la nouvelle clé
4. Sauvegarder

La rotation est transparente — les conversations en cours qui réfèrent à
cette clé continuent de fonctionner (la clé est rechargée à chaque appel).
