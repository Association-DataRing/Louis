# État réel des fonctionnalités

> Source de vérité — mis à jour 2026-05-16 (audit Phase 0 avant publication open-source).
> Légende : 🟢 fonctionnel · 🟡 partiel · 🔴 annoncé mais absent · ⚪ planifié

## Chat & raisonnement

| Feature | Statut | Code | Remarques |
|---|---|---|---|
| Chat streaming multi-tour, multi-provider | 🟢 | `src/app/api/chat/route.ts`, `chat-shell.tsx` | `streamText` + `useChat`, persistance auto on `onFinish` |
| Persistance des conversations (Postgres) | 🟢 | `schema/conversations.ts`, `schema/messages.ts` | parts JSONB rejouées au reload |
| Tool calling Légifrance | 🟢 | `lib/connectors/piste.ts:legifranceSearch`, `lib/connectors/tools.ts:87` | Endpoint `lf-engine-app`, fond ALL par défaut |
| Tool calling Pappers | 🟢 | `lib/connectors/pappers.ts` | Search + Get |
| Tool calling Judilibre | 🔴 | — | Annoncé dans `catalog.ts:37` et README. **Pas implémenté.** |
| Tool calling JADE | 🔴 | — | Annoncé. **Pas implémenté.** |
| Tool calling INPI | 🔴 | — | Annoncé. **Pas implémenté.** |
| Tool calling BODACC | 🔴 | — | Annoncé. **Pas implémenté.** |
| RAG sémantique pgvector | 🟢 | `lib/rag/{chunk,embed,search}.ts`, `lib/connectors/tools.ts:search_documents` | Cosine, top-6, scoped userId. Requiert clé Mistral active pour embed. |
| DocPanel side-by-side | 🟢 | `chat/doc-panel.tsx`, `pdf-view.tsx`, `docx-view.tsx` | PDF via react-pdf (sans toolbar), DOCX via docx-preview ou Gotenberg-rendered PDF |
| Citations cliquables + surlignage cible | 🟡 | `doc-panel.tsx:targetText` → `PdfView`/`DocxView` | `targetText` est propagé, **UX du highlight non vérifiée bout-en-bout**. À tester manuellement avant claim README. |
| Épingler conversations | 🟢 | `chat/actions.ts:togglePinAction`, `sidebar-content.tsx`, `schema/conversations.ts:pinnedAt` | Tri pinned-first |
| Recherche locale sidebar | 🟢 | `sidebar-content.tsx:filteredConversations` | Filtre client-side |
| Cmd+K palette globale | 🟢 | `command-palette.tsx` | cmdk, 7 groupes : Conversations / Projets / Documents / Workflows / Pages / Actions / Admin |
| Export Markdown d'une conversation | 🟢 | `chat-shell.tsx` (Blob client-side) | Téléchargement direct |
| Export PDF via impression navigateur | 🟢 | `app/print/chat/[id]/page.tsx`, `print-trigger.tsx` | Auto `window.print()` à l'ouverture |

## Documents

| Feature | Statut | Code | Remarques |
|---|---|---|---|
| Upload PDF/DOCX/texte ≤ 25 Mo | 🟢 | `app/api/documents/upload/route.ts` | Validation type + taille |
| Extraction texte serveur (cap 500k chars) | 🟢 | `lib/extract.ts` | Statut `ok` / `truncated` / `failed` persisté |
| Chunking + embeddings Mistral + insert document_chunks | 🟢 | `lib/rag/{chunk,embed}.ts` | Best-effort : si pas de clé Mistral, fallback system-prompt |
| Hiérarchie de dossiers + breadcrumb | 🟢 | `schema/document-folders.ts` self-ref, `app/(app)/documents/page.tsx` walking parentFolderId | Profondeur illimitée |
| Versioning v1/v2/v3 | 🟢 | `upload/route.ts:replacesId`, `parentDocumentId`, `version` | Familles groupées en page documents |
| Projets (conteneurs client) | 🟢 | `app/(app)/projects/`, `schema/projects.ts` | |
| Move-to-project (chat/conversation/document) | 🟢 | `chat/actions.ts`, `documents/actions.ts` | |

## Productivité avocat

| Feature | Statut | Code | Remarques |
|---|---|---|---|
| Analyses tabulaires (N×M, `generateObject` + Zod) | 🟢 | `tabular-reviews/actions.ts` | `EXTRACTION_CONCURRENCY = 3` |
| Traitement async via `next/server::after()` | 🟢 | `tabular-reviews/actions.ts:6` | Sliding window, AutoRefresh client |
| Workflows (bibliothèque cabinet) | 🟢 | `app/(app)/workflows/`, `schema/workflows.ts` | CRUD complet |
| 5 workflows par défaut (résumé arrêt, analyse clause, comparaison, due diligence, note de synthèse) | 🟢 | `workflows/actions.ts:DEFAULTS` | Import via bouton dédié |
| Suivi coûts par modèle (€/$) | 🟢 | `lib/providers/pricing.ts`, `app/(app)/usage/page.tsx`, `settings/usage/page.tsx` | Mensuel + all-time, pill header chat |

## Providers IA (BYOK)

| Feature | Statut | Code | Remarques |
|---|---|---|---|
| Mistral | 🟢 | `providers/factory.ts:50` | SDK officiel |
| Anthropic | 🟢 | `factory.ts:52` | SDK officiel |
| OpenAI | 🟢 | `factory.ts:54` | SDK officiel |
| Scaleway (OpenAI-compat) | 🟢 | `factory.ts:56` | baseURL `api.scaleway.ai/v1` |
| Albert (Etalab) | 🟢 | `factory.ts:61` | baseURL `albert.api.etalab.gouv.fr/v1` |
| OVH AI Endpoints | 🟢 | `factory.ts:66` | URL par modèle, override via baseUrl |
| OpenAI-compatible générique (Ollama/vLLM/llama.cpp) | 🟢 | `factory.ts:73` | baseUrl requis |
| Chiffrement AES-256-GCM des clés | 🟢 | `lib/crypto.ts` | ⚠️ scryptSync per-call (audit H2) |
| Badges souveraineté FR/UE/US | 🟢 | `providers/catalog.ts:SOVEREIGNTY_LABEL` | Affiché par card |
| Test de connexion | 🟢 | `providers/test.ts` | |

## Connecteurs juridiques

| Feature | Statut | Code | Remarques |
|---|---|---|---|
| PISTE OAuth (client_credentials) | 🟢 | `connectors/piste.ts:getToken` | Cache token + invalidation 401 |
| PISTE → Légifrance search | 🟢 | `piste.ts:legifranceSearch` | |
| PISTE → Judilibre / JADE / INPI / BODACC | 🔴 | — | **Annoncés dans README et `catalog.ts:unlocks` mais aucun appel API codé**. Doit être déclassé en "planifié" ou implémenté. |
| Pappers (entreprises, dirigeants) | 🟢 | `connectors/pappers.ts` | |
| MCP-native (serveurs MCP par utilisateur) | 🟢 | `lib/mcp/{client,tools}.ts`, `settings/mcp/`, `schema/mcp-servers.ts` | `buildMcpToolsForUser` + tools cachés en DB |
| Enveloppe `ToolResult` uniforme | 🟢 | `lib/tools/result.ts` | `{ ok, reason, error }` |

## Multi-utilisateur

| Feature | Statut | Code | Remarques |
|---|---|---|---|
| NextAuth v5 Credentials + JWT | 🟢 | `auth/index.ts` | bcrypt cost 12 |
| RBAC admin/member | 🟢 | `lib/auth/permissions.ts`, `schema/users.ts:userRoleEnum` | `requireAdmin`, `requireRole` |
| Page admin : créer / désactiver / changer rôle / supprimer | 🟢 | `app/(app)/admin/users/actions.ts` | 4 actions + recordAudit |
| Page admin cabinet (texte footer, métadonnées) | 🟢 | `admin/cabinet/cabinet-form.tsx` | placeholders neutralisés en Phase 1 (« Votre cabinet ») |

## Sécurité & infrastructure

| Feature | Statut | Code | Remarques |
|---|---|---|---|
| Docker Compose (Postgres+pgvector / Redis / MinIO / Gotenberg) | 🟢 | `docker-compose.yml` | Port 5433 pour Postgres |
| Audit log — infrastructure | 🟢 | `schema/audit-log.ts`, `lib/audit.ts:recordAudit`, `admin/audit/page.tsx` | Table + helper + page lecture |
| Audit log — wiring user.* (create/update/disable/delete) | 🟢 | `admin/users/actions.ts` | 4 appels `recordAudit` |
| Audit log — wiring provider.* / connector.* / doc.delete / cabinet.update / auth.* | 🔴 | — | **Déclaré dans `ACTION_LABEL` mais aucun appel `recordAudit` correspondant.** Page affichera toujours vide pour ces actions. |
| Rate-limit Redis sur API | 🔴 | — | **Annoncé dans README ligne 111 ("cache, rate-limit") et SECURITY.md ligne 35. Aucun code de rate-limit.** Redis dans docker-compose mais inutilisé. |
| Smoke tests E2E Playwright (11 routes) | 🟢 | `tests/e2e/{auth,chat,navigation}.spec.ts` | |
| CI lint + build avec placeholders | 🟢 | `.github/workflows/ci.yml` | |
| SSL Postgres strict en prod | 🟡 | `db/index.ts:13` | Détection automatique mais `rejectUnauthorized: false` toujours |
| Headers HTTP sécu (CSP, HSTS, X-Frame, X-Content-Type) | 🔴 | — | Aucun middleware Next.js de sécurité |
| Sanitization filename avant S3 key | 🔴 | `upload/route.ts:101` | Raw `file.name` interpolé |

## Génération de documents

| Feature | Statut | Code | Remarques |
|---|---|---|---|
| `generate_document` (DOCX + PDF preview Gotenberg) | 🟢 | `lib/docgen/`, `connectors/tools.ts:generate_document` | Schéma sections typé (titres 1-4, paragraphes, listes, blockquotes, tables, sauts de page, séparateurs) |
| `edit_document` (tracked edits ::before/::after/::reason) | 🟢 | `lib/docgen/docx-tracked.ts`, `chat/edit-card.tsx` | Card cliquable accept/reject inline |
| DOCX → PDF fidèle via Gotenberg | 🟢 | `lib/docgen/libreoffice.ts` | Fallback LibreOffice local, puis HTML mammoth |

## Synthèse Phase 0

**Sur ~30 sub-features annoncées dans le README :**
- 🟢 fonctionnel : **24** (~80 %)
- 🟡 partiel : **3** (~10 %) — citations highlight UX à valider, audit log partiellement wired, SSL postgres non-strict
- 🔴 annoncé mais absent : **4** (~13 %) — Judilibre/JADE/INPI/BODACC, rate-limit Redis, audit log pour provider/connector/doc/auth, headers HTTP sécu, sanitization filename

## Corrections requises avant publication (Phase 1)

Le README doit être réécrit pour refléter ce tableau. Les claims rouges doivent **soit être implémentés en Phase 2-3, soit déclassés en "planifié"**.

**Recommandation tranchée pour gagner du temps :**

| Item | Décision proposée | Justif |
|---|---|---|
| Judilibre/JADE/INPI/BODACC | **Déclasser** → "Planifié v0.2" | Implémenter 4 sub-APIs PISTE en 3 semaines en plus du reste = irréaliste. Mieux vaut une promesse honnête. |
| Rate-limit Redis | **Implémenter** Phase 2 | Cœur de la promesse "souveraine + multi-user". Un MVP en `@upstash/ratelimit` ou redis-rs prend 1 j. |
| Audit log élargi | **Implémenter** Phase 2 | recordAudit existe, il manque 6 appels à insérer dans les actions admin/providers/connectors/docs. ~2h. |
| SSL postgres strict | **Implémenter** Phase 2 | 1h doc + 1h code |
| Headers HTTP sécu | **Implémenter** Phase 2 | Middleware Next.js + 1 fichier |
| Sanitization filename | **Implémenter** Phase 2 | 5 lignes |
| Citations highlight UX | **Tester manuellement**, puis garder ou taguer "beta" | Test avant publication |
