# Glossaire

## Sources juridiques

- **Légifrance** — service public de diffusion du droit français. Source
  unique des textes officiels (Constitution, codes, lois, décrets,
  conventions). Édité par la DILA.
- **Judilibre** — base ouverte des décisions de la Cour de cassation et
  des cours d'appel. Éditée par la Cour de cassation.
- **JADE** — Jurisprudence Administrative Diffusée sur Espace numérique.
  Base ouverte des décisions du Conseil d'État, des cours administratives
  d'appel et des tribunaux administratifs. Éditée par le Conseil d'État.
- **INPI** — Institut national de la propriété industrielle. Base
  marques, brevets, dessins et modèles.
- **BODACC** — Bulletin officiel des annonces civiles et commerciales.
  Annonces légales obligatoires (créations, modifications,
  liquidations).
- **PISTE** — Plateforme d'Intermédiation des Services Techniques de
  l'État. Passerelle d'API gouvernementales (OAuth) — donne accès à
  Légifrance, Judilibre, JADE, INPI et BODACC avec un seul couple
  client_id / client_secret.
- **Pappers** — service privé d'agrégation des données entreprises
  françaises (SIRENE, RNCS, dirigeants, comptes annuels, bénéficiaires
  effectifs).
- **DILA** — Direction de l'information légale et administrative.
  Éditeur public de Légifrance.

## IA et tech

- **BYOK** — Bring Your Own Key. Modèle où chaque utilisateur fournit
  ses propres clés provider. Louis fonctionne exclusivement en BYOK.
- **RAG** — Retrieval-Augmented Generation. Technique d'enrichissement
  d'un LLM avec une recherche dans une base de documents : on découpe les
  documents en chunks, on les embedde, on retrouve les plus proches d'une
  requête, on les ajoute au prompt.
- **Embedding** — représentation vectorielle d'un texte (en v0.1, vecteur
  de 1024 dimensions via `mistral-embed`).
- **pgvector** — extension Postgres qui ajoute le type `vector(N)` et
  les opérateurs de distance cosinus / euclidienne / inner product.
- **HNSW** — Hierarchical Navigable Small World, index approximatif
  pour la recherche vectorielle. Performant jusqu'à dizaines de millions
  de vecteurs.
- **MCP** — Model Context Protocol (Anthropic, 2024). Standard ouvert
  pour exposer des tools à un LLM via une interface uniforme. Louis
  supporte les serveurs MCP par utilisateur.
- **Tool calling** — capacité d'un LLM à appeler des fonctions (avec un
  schéma typé en entrée) et de raisonner sur leur retour. Louis utilise
  Vercel AI SDK v6 pour orchestrer.
- **`generateObject`** — fonction de l'AI SDK qui force un LLM à
  produire un objet conforme à un schéma Zod. Utilisé pour les analyses
  tabulaires.
- **Streaming SSE** — Server-Sent Events. Les réponses chat arrivent
  token-par-token via HTTP long-lived au lieu d'un round-trip complet.

## Sécurité

- **AGPL** — GNU Affero General Public License. Variante de la GPL qui
  étend l'obligation de partage des modifications au cas SaaS. Cf. ADR
  0002.
- **AES-256-GCM** — chiffrement symétrique authentifié, mode Galois.
  Standard moderne. Louis l'utilise pour les provider keys et
  connector keys.
- **scrypt** — fonction de dérivation de clé (KDF). Louis dérive la clé
  AES depuis `ENCRYPTION_KEY` une fois au démarrage.
- **bcrypt** — KDF spécifique aux mots de passe. Louis utilise cost 12
  (2^12 itérations).
- **JWT** — JSON Web Token. NextAuth v5 signe une session avec
  `AUTH_SECRET` et la pose dans un cookie `httpOnly` `secure`
  `SameSite=Lax`.
- **HSTS** — HTTP Strict Transport Security. Header qui force le
  navigateur à utiliser HTTPS pour les requêtes futures vers ce domaine.
  Posé par le middleware Louis en `NODE_ENV=production`.
- **CSP** — Content Security Policy. Header qui restreint quelles sources
  de scripts / styles / images / etc. le navigateur accepte. Louis
  l'applique en mode permissif sur les inline scripts en v0.1
  (durcissement nonce v0.1.x).
- **SecNumCloud** — référentiel de qualification cloud de l'ANSSI pour
  les données sensibles. Louis n'est pas certifié mais peut être déployé
  sur une infrastructure SecNumCloud (Scaleway, OVH Sovereign Cloud).

## Stack Louis

- **Next.js 16 App Router** — framework full-stack React avec Server
  Components, Server Actions, streaming SSE, route handlers.
- **React Compiler** — compilateur React qui mémoize automatiquement.
  Activé via `babel-plugin-react-compiler` (cf. `next.config.ts`).
- **shadcn/ui** — collection de composants React copiables (pas une lib
  installée). Basés sur Radix UI primitives + Tailwind.
- **Drizzle ORM** — ORM TypeScript-first pour Postgres. Schéma déclaratif,
  requêtes type-safe, migrations contrôlables.
- **Vercel AI SDK v6** — couche d'abstraction multi-provider pour le
  streaming et le tool calling.
- **Tailwind CSS v4** — utility-first CSS. Louis utilise des tokens
  OKLCH (perceptual color space) pour une cohérence cross-mode (light/dark).
- **Gotenberg** — service HTTP qui wrap LibreOffice headless. Louis
  l'utilise pour la conversion DOCX → PDF fidèle.
