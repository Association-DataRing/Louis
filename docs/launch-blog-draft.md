# Blog post — draft

> À publier sur https://data-ring.net le jour du launch.

---

## Louis — une IA juridique open-source, faite pour rester chez vous

Aujourd'hui, l'association DataRing publie **Louis v0.1.0**, une plateforme d'intelligence artificielle pour les professions juridiques françaises. Open-source AGPL-3.0. Auto-hébergeable. Sans intermédiaire.

### Le problème

Les outils d'IA juridique disponibles aujourd'hui imposent un choix difficile :

- **Confier ses données clients à un SaaS américain** — souvent en violation du secret professionnel, en zone grise RGPD, sans visibilité sur ce qui transite, ni sur où est stocké quoi.
- **Renoncer à l'IA** — et regarder les confrères qui s'équipent rogner les marges de temps et de qualité.

Aucune des deux options n'est satisfaisante quand on prend au sérieux le serment d'avocat ou l'engagement de confidentialité d'un juriste d'entreprise.

### Notre proposition

Une troisième voie : **un logiciel libre, auto-hébergé, qui orchestre vos propres fournisseurs IA et vos propres sources juridiques.**

Concrètement, Louis tourne sur **votre** serveur (un Mac mini suffit, ou un serveur dédié si vous préférez). Vous configurez **vos propres clés** Mistral, Scaleway, OVH, Albert (Etalab), Anthropic, OpenAI, ou un modèle auto-hébergé. **Aucun appel IA ne transite par DataRing.** Pas de proxy. Pas de relais. Pas de mutualisation.

### Le manifeste

Louis tient en 5 principes :

1. **Vos clés, pas les nôtres.** BYOK sur tous les providers. Clés chiffrées AES-256-GCM côté serveur.
2. **Vos connecteurs, pas les nôtres.** PISTE (Légifrance), Pappers — vous configurez vos accès, vos quotas, vos contrats.
3. **Vos données, chez vous.** PostgreSQL local, pgvector local, fichiers chiffrés sur votre stockage S3-compatible. Docker Compose en une commande.
4. **Open-source AGPL-3.0.** Le code est lisible, modifiable, auditable. Toute amélioration apportée à un déploiement public revient à la communauté. Et il n'y aura jamais de version "premium" cachée du moteur.
5. **Souverain par défaut.** Les fournisseurs français et européens sont en première ligne. Les fournisseurs américains restent disponibles mais optionnels — un badge **FR / UE / US** accompagne chaque clé.

### Qu'est-ce qui marche en v0.1 ?

La liste exhaustive et honnête est dans [`docs/feature-status.md`](https://github.com/DataRing/louis/blob/main/docs/feature-status.md).

En résumé :

- **Chat streaming** multi-provider, multi-tour, persistance auto
- **DocPanel side-by-side** — preview PDF natif, rendu DOCX fidèle via Gotenberg
- **RAG** sur vos documents (chunking + embeddings Mistral + recherche vectorielle pgvector)
- **Analyses tabulaires** N×M (N colonnes prompts × M documents, extraction structurée)
- **Workflows** — bibliothèque de prompts cabinet, 5 prêts à l'emploi (résumé d'arrêt, analyse de clause, comparaison contrats, due diligence, note de synthèse)
- **Génération de documents** DOCX + PDF preview, **édits trackés Word natifs** sur fichiers existants
- **Connecteur Légifrance** via PISTE, **connecteur Pappers** (entreprises)
- **MCP-native** : branchez vos propres serveurs MCP par utilisateur
- **Multi-utilisateur** avec RBAC admin/member, journal d'audit append-only
- **Suivi des coûts** par modèle (€ / $), mensuel + all-time

### Sécurité prise au sérieux

Quelques choix structurants :

- **AES-256-GCM** authentifié pour les clés provider (jamais en clair)
- **Rate-limit Redis** sur chat / upload / login (anti brute-force)
- **Middleware HTTP** : CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Permissions-Policy
- **SSL Postgres strict** par défaut en prod
- **Sanitization filename** anti-injection HTTP header
- **Journal d'audit** sur 13 actions sensibles (login, providers, connecteurs, documents, cabinet)
- **CI** : `npm audit --audit-level=high`, `license-checker` allowlist AGPL, tests unitaires (15 sur la crypto et le rate-limit)

Le modèle de menace complet est documenté dans [`docs/security/threat-model.md`](https://github.com/DataRing/louis/blob/main/docs/security/threat-model.md).

### Ce qui n'est pas encore là

Honnêteté radicale : la v0.1 est une **alpha**. Quelques zones partielles ou planifiées :

- **Judilibre / JADE / INPI / BODACC** — l'infrastructure PISTE est en place, seul Légifrance est wiré. Le reste arrive en v0.1.x (Q3 2026).
- **i18n anglais** — v0.2.
- **Project sharing** entre membres du cabinet — v0.2.
- **2FA admin, Helm chart Kubernetes, SecNumCloud-ready** — v0.2+.

Voir la [roadmap](https://github.com/DataRing/louis#roadmap-publique).

### Comment essayer ?

10 minutes sur un Mac récent ou un Linux :

```bash
git clone https://github.com/DataRing/louis.git
cd louis
cp .env.example .env
echo "AUTH_SECRET=$(openssl rand -base64 32)" >> .env
echo "ENCRYPTION_KEY=$(openssl rand -base64 32)" >> .env
npm install && docker compose up -d && npm run db:setup
ADMIN_PASSWORD="$(openssl rand -base64 16)" npm run demo
npm run dev
```

→ http://localhost:3000 avec un admin pré-configuré, 5 workflows juridiques importés, 3 dossiers documents prêts à recevoir vos PDFs.

### Pourquoi DataRing ?

Parce que la souveraineté numérique des professions du droit ne peut pas dépendre d'une démarche commerciale. Elle dépend d'un **commun** — code lisible, auditable, redistribuable, **possédé par personne**.

Louis appartient à celles et ceux qui le déploient. C'est tout l'esprit de l'AGPL, et c'est tout l'esprit de DataRing.

### Pour aller plus loin

- ⭐ Le repo : https://github.com/DataRing/louis
- 💬 Les discussions : https://github.com/DataRing/louis/discussions
- 📜 La licence : [AGPL-3.0-or-later](https://github.com/DataRing/louis/blob/main/LICENSE)
- 🛡️ Signaler une vulnérabilité : `security@data-ring.net`
- ✉️ Échanger : `contact@data-ring.net`

---

— **France Charruyer**, pour l'association DataRing.

> _« Justicia est constans et perpetua voluntas jus suum cuique tribuendi. »_  
> — Ulpien, *Digeste* 1.1.10.
