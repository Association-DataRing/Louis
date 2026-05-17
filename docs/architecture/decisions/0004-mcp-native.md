# ADR 0004 — Support MCP natif, par utilisateur

- **Statut** : adopté
- **Date** : 2026
- **Décideur** : association DataRing

## Contexte

Le **Model Context Protocol** (MCP, Anthropic 2024) est un standard
émergent pour donner aux LLMs accès à des outils / sources de données
externes, de manière standardisée. Au lieu de coder chaque connecteur en
dur dans Louis, un serveur MCP expose ses tools, et un client LLM les
appelle via un protocole commun.

## Décision

**Louis supporte les serveurs MCP nativement, configurés par utilisateur.**

Chaque utilisateur peut, depuis **Settings → Serveurs MCP**, ajouter
l'URL et les headers d'auth d'un serveur MCP arbitraire. Louis :

1. Liste automatiquement les tools exposés
2. Les rend disponibles dans le chat, préfixés `mcp__<server>__<tool>`
3. Exécute les calls via une connexion MCP fraîche par appel (suffisant
   pour v0.1)

Cf. `src/lib/mcp/{client,tools}.ts` et `src/db/schema/mcp-servers.ts`.

## Conséquences

### Positives

- **Extensibilité sans modifier Louis** : un cabinet peut brancher son
  ERP, sa base de précédents, son CRM via MCP sans toucher au code
- **Compatibilité écosystème** : tout serveur MCP existant (officiels
  Anthropic + tiers) fonctionne immédiatement
- **Isolation user** : chaque user voit ses propres serveurs, pas ceux
  des autres — pas de fuite de tools entre comptes

### Négatives

- **Surface d'attaque étendue** : un serveur MCP malveillant configuré
  par un user peut tenter d'extraire des infos via les tools. Mitigation :
  les tools MCP n'ont accès qu'aux données qu'on leur passe en argument,
  jamais directement à la DB Louis
- **Connexion fraîche par call** : overhead réseau modeste, simple à
  raisonner pour v0.1. Pool de connexions à envisager si gros volume
- **Standard jeune** : MCP évolue. Louis suit la spec, à re-tester à
  chaque release de la lib `@modelcontextprotocol/sdk`

### Implications produit

- Pas de "catalogue MCP officiel Louis" en v0.1 — le user pointe vers
  l'URL qu'il connaît. En v0.2 envisager un curated registry.
- Le RAG `search_documents` reste un tool natif (pas via MCP) parce
  qu'il accède à des données internes Louis (chunks indexés du user).
  Un MCP server ne peut pas faire ça proprement sans casser l'isolation.
