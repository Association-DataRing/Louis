# Installation en une commande

Un **installeur interactif** (TUI) prépare Louis de bout en bout dans le
terminal : Docker, configuration, provider IA et compte administrateur. Le seul
prérequis est **Node.js ≥ 18** — si Docker manque, l'installeur l'installe.

## Lancer l'installeur

**macOS / Linux / Windows :**

```bash
npx -y github:Association-DataRing/Louis#installer
```

> Les anciens raccourcis restent valides et se contentent d'appeler la commande
> `npx` ci-dessus :
>
> ```bash
> # macOS / Linux
> curl -fsSL https://raw.githubusercontent.com/Association-DataRing/Louis/main/scripts/install.sh | bash
> ```
> ```powershell
> # Windows (PowerShell)
> irm https://raw.githubusercontent.com/Association-DataRing/Louis/main/scripts/install.ps1 | iex
> ```
>
> Sur une machine Windows neuve, Docker Desktop s'appuie sur **WSL2** : Windows
> peut demander **un redémarrage** pour le finaliser. Dans ce cas, redémarrez
> puis relancez la commande — l'installeur reprend là où il en était.

## Ce que fait l'installeur

1. **Docker** — le vérifie, l'installe s'il manque (Docker Desktop sur macOS et
   Windows, Docker Engine sur Linux) et le démarre s'il est arrêté. Au premier
   lancement de Docker Desktop, une fenêtre demande d'accepter les conditions :
   un clic, et l'installeur reprend tout seul.
2. **Configuration** — dossier d'installation, port HTTP, tag d'image, et une
   section **avancée** optionnelle : backend d'embedding souverain
   (Ollama/vLLM/TEI) et durcissement SSRF.
3. **Intelligence (IA)** — choix d'un provider et **test de la clé** avant
   enregistrement (optionnel : vous pouvez le faire plus tard).
4. **Compte administrateur** — nom, e-mail, mot de passe (12 caractères min.).
5. **Secrets & stack** — génère un `.env` avec des secrets aléatoires (jamais
   écrasés s'ils existent), télécharge le `docker-compose.prod.yml` et démarre
   les cinq services : Louis, PostgreSQL + pgvector, Redis, MinIO, Gotenberg.
6. **Schéma & premier compte** — applique le schéma (service `migrate`,
   one-shot), puis crée l'administrateur et la clé IA **directement**, sans
   passer par le navigateur.

À la fin, ouvrez `http://localhost:3000`, connectez-vous, et la première
conversation est à un clic.

> Si la création du compte en terminal échoue pour une raison quelconque,
> l'assistant navigateur `/setup` prend le relais au premier accès — rien n'est
> perdu.

## Mode non-interactif (CI, provisioning, pipe)

Passez `--yes` et fournissez les identifiants via des variables
d'environnement :

```bash
LOUIS_ADMIN_NAME="Marie Dupont" \
LOUIS_ADMIN_EMAIL=marie@cabinet.fr \
LOUIS_ADMIN_PASSWORD='un-mot-de-passe-tres-long' \
LOUIS_PROVIDER=mistral \
LOUIS_PROVIDER_KEY=sk-… \
  npx -y github:Association-DataRing/Louis#installer --yes
```

Sans identifiants admin, le mode non-interactif installe quand même la stack et
laisse la création du compte à l'assistant navigateur `/setup`.

## Options

| Variable / option | Défaut | Rôle |
|---|---|---|
| `LOUIS_DIR` / `--dir` | `./louis` | dossier d'installation |
| `LOUIS_PORT` / `--port` | `3000` | port HTTP local |
| `LOUIS_VERSION` / `--tag` | `latest` | tag d'image (ex. `v0.2.0`) |
| `LOUIS_REPO_RAW` / `--repo-raw` | repo officiel | base raw GitHub (fork, miroir) |
| `LOUIS_ADMIN_NAME` | — | nom de l'administrateur (mode `--yes`) |
| `LOUIS_ADMIN_EMAIL` | — | e-mail de l'administrateur (mode `--yes`) |
| `LOUIS_ADMIN_PASSWORD` | — | mot de passe (12 caractères min.) |
| `LOUIS_PROVIDER` | — | provider IA (`mistral`, `anthropic`, `openai`, …) |
| `LOUIS_PROVIDER_KEY` | — | clé API du provider |
| `LOUIS_PROVIDER_BASE_URL` | — | base URL (Scaleway / OVH / endpoint compatible) |

```bash
npx -y github:Association-DataRing/Louis#installer --port 8080 --tag v0.2.0
```

Liste complète : `npx -y github:Association-DataRing/Louis#installer --help`.

## Mise à jour

Le plus simple — **relancez la commande d'installation** sur le même dossier :
l'installeur détecte l'instance existante, récupère la dernière image et
redémarre, en conservant vos données et vos secrets.

```bash
npx -y github:Association-DataRing/Louis#installer
```

Ou, depuis le dossier d'installation, le script déposé à l'install :

```bash
cd louis && ./update.sh          # macOS / Linux
```
```powershell
cd louis; .\update.ps1           # Windows
```

Dans tous les cas, le service `migrate` ré-applique le schéma (idempotent)
avant le redémarrage de l'app — pas d'étape manuelle. Vos données (base,
documents) et vos secrets (`.env`) sont préservés.

## Sauvegarde

Le fichier `louis/.env` contient `ENCRYPTION_KEY`, qui chiffre les clés API
stockées : **sa perte rend ces clés irrécupérables**. Sauvegardez-le avec vos
données (cf. [Sauvegarde et restauration](../admin/backups.md) pour la base).

## Accès distant

Seul le port de l'app est exposé. Pour servir Louis en HTTPS sur un domaine,
placez un reverse proxy TLS devant (Caddy, Nginx, Traefik) — voir les
exemples de la page [bare-metal](./bare-metal.md).

## Désinstallation

```bash
cd louis
docker compose -f docker-compose.prod.yml down          # stop
docker compose -f docker-compose.prod.yml down -v       # stop + données (irréversible)
```
