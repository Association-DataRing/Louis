# Installation en une commande

La façon la plus simple d'installer Louis sur une machine (poste de cabinet,
serveur, VPS). **Aucun prérequis à installer soi-même** : si Docker manque, le
script l'installe.

```bash
curl -fsSL https://raw.githubusercontent.com/Association-DataRing/Louis/main/scripts/install.sh | bash
```

Le script :

1. **vérifie Docker** — l'installe s'il manque (Docker Desktop sur macOS,
   Docker Engine sur Linux) et le démarre s'il est arrêté. Au premier
   lancement de Docker Desktop sur Mac, une fenêtre demande d'accepter les
   conditions : un clic, et le script reprend tout seul ;
2. crée un dossier `./louis` contenant le `docker-compose.prod.yml` et un
   fichier `.env` avec des **secrets générés aléatoirement** (jamais écrasés
   s'ils existent — relancer le script est sans danger) ;
3. télécharge les images publiées sur GHCR (app pré-buildée + migrateur de
   schéma) et démarre les cinq services : Louis, PostgreSQL + pgvector,
   Redis, MinIO, Gotenberg ;
4. applique le schéma de base automatiquement (service `migrate`, one-shot) ;
5. ouvre `http://localhost:3000` — **l'assistant de premier lancement**
   prend le relais : compte administrateur, première clé IA (testée avant
   enregistrement), et la première conversation est à un clic.

Aucun terminal n'est nécessaire après cette commande.

## Variables optionnelles

| Variable | Défaut | Rôle |
|---|---|---|
| `LOUIS_DIR` | `./louis` | dossier d'installation |
| `LOUIS_VERSION` | `latest` | tag d'image (ex. `v0.2.0`) |
| `LOUIS_PORT` | `3000` | port HTTP local |
| `LOUIS_REPO_RAW` | repo officiel | base raw GitHub (fork, miroir interne) |

```bash
LOUIS_PORT=8080 LOUIS_VERSION=v0.2.0 \
  curl -fsSL https://raw.githubusercontent.com/Association-DataRing/Louis/main/scripts/install.sh | bash
```

## Mise à jour

Le plus simple — **relancez la commande d'installation** : elle récupère la
dernière image et redémarre, en conservant vos données et vos secrets.

```bash
curl -fsSL https://raw.githubusercontent.com/Association-DataRing/Louis/main/scripts/install.sh | bash
```

Ou, depuis le dossier d'installation, le script déposé à l'install :

```bash
cd louis && ./update.sh
```

Dans les deux cas, le service `migrate` ré-applique le schéma (idempotent)
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
