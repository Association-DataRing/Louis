# create-louis

Installeur interactif (TUI) de **[Louis](https://github.com/Association-DataRing/Louis)** — l'IA juridique souveraine, open-source, auto-hébergée.

Une seule commande, aucun prérequis à part **Node ≥ 18** (Docker est installé
automatiquement s'il manque) :

```bash
npx -y github:Association-DataRing/Louis#installer
```

L'assistant vous guide dans le terminal :

1. **Docker** — vérifie, installe et démarre Docker si nécessaire ;
2. **Configuration** — dossier, port, version d'image, options avancées
   (embedding souverain, durcissement SSRF) ;
3. **Intelligence** — choix d'un provider IA et **test de la clé** avant
   enregistrement (optionnel) ;
4. **Compte administrateur** — nom, e-mail, mot de passe ;
5. **Démarrage** — génère les secrets (`.env`), télécharge le
   `docker-compose.prod.yml`, lance la stack (app, PostgreSQL + pgvector, Redis,
   MinIO, Gotenberg), applique le schéma, puis crée l'admin et la clé.

À la fin, Louis est prêt : vous vous connectez et vous conversez.

> Relancer la commande sur un dossier déjà installé **met simplement à jour**
> Louis (image + redémarrage). Vos données et vos secrets sont conservés.

## Mode non-interactif (CI / pipe)

```bash
LOUIS_ADMIN_NAME="Marie Dupont" \
LOUIS_ADMIN_EMAIL=marie@cabinet.fr \
LOUIS_ADMIN_PASSWORD='un-mot-de-passe-tres-long' \
LOUIS_PROVIDER=mistral \
LOUIS_PROVIDER_KEY=sk-… \
  npx -y github:Association-DataRing/Louis#installer --yes
```

Voir `npx -y github:Association-DataRing/Louis#installer --help` pour la liste
complète des options et variables d'environnement.

## Licence

AGPL-3.0-or-later — comme Louis.
