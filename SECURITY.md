# Politique de sécurité

Louis manipule des secrets sensibles (clés API providers, identifiants
PISTE/Pappers, mots de passe utilisateurs) et est destiné à un environnement
de travail juridique soumis au secret professionnel. Les questions de
sécurité sont prioritaires.

## Signaler une vulnérabilité

**Ne créez pas d'issue publique.**

Envoyez un email à **security@altij.com** avec :

- la description de la vulnérabilité
- les étapes pour la reproduire
- l'impact potentiel (lecture de secrets, élévation de privilèges, RCE, …)
- votre identité (optionnelle, mais utile pour vous créditer)

Vous recevrez une première réponse sous **72 heures ouvrées**.

## Notre engagement

- Coordonner avec vous un calendrier de divulgation responsable.
- Publier un correctif dans une release dédiée (`vX.Y.Z+security`).
- Vous créditer publiquement dans le `CHANGELOG.md` (sauf demande contraire).

## Hors-scope

Les éléments suivants ne sont pas considérés comme des vulnérabilités :

- Exécution arbitraire via une clé API que l'utilisateur a lui-même fournie
  à son propre déploiement (l'utilisateur est admin de son instance).
- Comportements résultant d'une configuration `ENCRYPTION_KEY` faible ou
  partagée publiquement.
- DoS volumétrique (Louis dépend du rate-limit Redis configuré par l'admin).
- Failles dans les providers IA tiers (à signaler directement chez eux).

## Bonnes pratiques côté admin

Lors du déploiement de Louis, en production :

- `ENCRYPTION_KEY` : générée par `openssl rand -base64 32`, jamais loggée,
  jamais commitée. Sa rotation invalide toutes les clés stockées.
- `AUTH_SECRET` : idem, ne JAMAIS la partager entre environnements.
- `DATABASE_URL` : sur le réseau privé uniquement. SSL obligatoire en prod.
- Postgres : sauvegardes chiffrées au repos. Restreindre les rôles à
  l'utilisateur `louis` (pas de `postgres` superuser dans l'app).
- Reverse-proxy : HTTPS obligatoire. HSTS recommandé.
- Backups : chiffrés indépendamment d'`ENCRYPTION_KEY` (autrement la
  rotation casserait l'ancien backup).
