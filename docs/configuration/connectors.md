# Configuration des connecteurs juridiques

## PISTE

Plateforme commune de la DILA pour accéder à Légifrance, Judilibre, JADE,
INPI et BODACC via OAuth.

- **Inscription** : https://piste.gouv.fr/
- **Documents** : créer une application, récupérer `client_id` et `client_secret`
- **Configuration Louis** : Settings → Connecteurs → "Ajouter PISTE"

### Couverture v0.1

| Sub-API PISTE | Statut |
|---|---|
| Légifrance | 🟢 Implémenté (`legifrance_search`) |
| Judilibre | ⚪ Planifié v0.1.x |
| JADE | ⚪ Planifié v0.1.x |
| INPI | ⚪ Planifié v0.1.x |
| BODACC | ⚪ Planifié v0.1.x |

Voir [`../feature-status.md`](../feature-status.md) pour le détail.

### Test

Une fois configuré, dans le chat : "Cherche dans Légifrance les articles
sur la responsabilité du fait des produits défectueux." Le modèle doit
appeler `legifrance_search` et restituer des liens vers legifrance.gouv.fr.

## Pappers

Base entreprises (SIREN, dirigeants, bénéficiaires effectifs).

- **Inscription** : https://www.pappers.fr/api
- **Quota** : selon votre forfait Pappers
- **Configuration Louis** : Settings → Connecteurs → "Ajouter Pappers"

### Test

"Donne-moi le profil juridique de l'entreprise SIREN 552032534" — devrait
appeler `pappers_search` ou `pappers_get`.

## MCP (Model Context Protocol)

En plus des connecteurs natifs, Louis supporte **n'importe quel serveur
MCP** (HTTP ou SSE) configuré par utilisateur.

- **Configuration Louis** : Settings → Serveurs MCP → "Ajouter un serveur"
- Renseigner URL + headers d'auth si nécessaires
- Louis liste automatiquement les tools exposés par le serveur
- Les tools sont préfixés `mcp__<nom-serveur>__<nom-tool>` dans le chat
  pour éviter les collisions

### Cas d'usage typiques

- Brancher un serveur MCP maison qui interroge la base de précédents du
  cabinet
- Plugger une API métier (ERP, CRM, signature électronique) pour que
  Louis puisse l'appeler en cours de conversation
- Connecter une base de jurisprudence privée
