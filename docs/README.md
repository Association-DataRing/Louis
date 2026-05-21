# Documentation Louis

Plateforme IA juridique souveraine, open-source. Initiée par l'association
**DataRing**. Cf. [`../README.md`](../README.md) pour la vue d'ensemble du
projet.

## Pour qui ?

- **Installateur / DSI** : [Installation](./installation/) → [Configuration](./configuration/)
- **Administrateur de l'instance** : [Admin guide](./admin/) → [Sécurité](./security/)
- **Utilisateur final (avocat·e, juriste)** : [User guide](./user/)
- **Contributeur** : [Architecture](./architecture/) + [`../CONTRIBUTING.md`](../CONTRIBUTING.md)

## Plan

### Installation

- [`installation/docker-compose.md`](./installation/docker-compose.md) — parcours par défaut (Docker)
- [`installation/bare-metal.md`](./installation/bare-metal.md) — sans Docker
- `installation/kubernetes.md` — Helm chart (v0.2)

### Configuration

- [`configuration/env-vars.md`](./configuration/env-vars.md) — référence exhaustive des variables d'environnement
- [`configuration/providers.md`](./configuration/providers.md) — comment configurer chaque provider IA
- [`configuration/connectors.md`](./configuration/connectors.md) — PISTE, Pappers

### Administration

- [`admin/users.md`](./admin/users.md) — gestion des comptes
- [`admin/audit-log.md`](./admin/audit-log.md) — journal d'audit
- [`admin/backups.md`](./admin/backups.md) — sauvegarde et restauration

### Sécurité

- [`security/threat-model.md`](./security/threat-model.md) — modèle de menace
- [`security/secret-rotation.md`](./security/secret-rotation.md) — rotation `ENCRYPTION_KEY`, `AUTH_SECRET`
- `security/secnumcloud-checklist.md` — préparation SecNumCloud (v0.2)

### Architecture

- [`architecture/overview.md`](./architecture/overview.md) — diagramme + flux
- [`architecture/data-model.md`](./architecture/data-model.md) — schéma Drizzle
- [`architecture/decisions/`](./architecture/decisions/) — ADRs

### Référence

- [`feature-status.md`](./feature-status.md) — état réel feature-par-feature
- [`faq.md`](./faq.md) — questions courantes
- [`glossary.md`](./glossary.md) — PISTE, Judilibre, RAG, BYOK, MCP, pgvector, etc.
