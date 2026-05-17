# Installation via Docker Compose

Parcours recommandé pour une première installation et pour le développement.

## Prérequis

- **Docker + Docker Compose** ≥ v2 (`docker compose version`)
- **Node.js ≥ 24** (`node -v`)
- Au moins **une clé API d'un provider IA**. Mistral est recommandé en v0.1
  car il fournit aussi les embeddings nécessaires au RAG.

## Étapes

```bash
git clone https://github.com/D4kooo/louis.git
cd louis

# 1. Configuration
cp .env.example .env
# Générer AUTH_SECRET et ENCRYPTION_KEY (256 bits aléatoires) :
echo "AUTH_SECRET=$(openssl rand -base64 32)" >> .env
echo "ENCRYPTION_KEY=$(openssl rand -base64 32)" >> .env

# 2. Services d'infrastructure (Postgres + Redis + MinIO + Gotenberg)
docker compose up -d

# 3. Schéma DB
npm install
npm run db:setup

# 4. Seed démo : admin + 5 workflows + 1 projet + 3 dossiers
#    Le mot de passe est généré aléatoirement et affiché une seule fois.
ADMIN_PW="$(openssl rand -base64 16)"
echo "Admin password : $ADMIN_PW"
ADMIN_EMAIL=admin@louis.local ADMIN_PASSWORD="$ADMIN_PW" npm run demo

# 5. Démarrage app
npm run dev
```

> ⚠️ **Ne déployez jamais avec un mot de passe trivial.** Le seed refuse
> tout mot de passe de moins de 12 caractères. Conservez celui généré
> ci-dessus dans votre gestionnaire de mots de passe.

L'app est sur [http://localhost:3000](http://localhost:3000). Connectez-vous
en `admin@louis.local` avec le mot de passe affiché ci-dessus.

## Vérification

Quatre points à vérifier :

1. **Login fonctionnel** — la page `/dashboard` charge sans erreur
2. **Workflows pré-importés** — `Cmd+K` → "workflow" → 5 résultats
3. **Health endpoint** — `curl http://localhost:3000/api/health` → `{"status":"ok",...}`
4. **Readiness endpoint** — `curl http://localhost:3000/api/ready` → `{"status":"ready",...}`
   (503 si Postgres ou Redis est down)

## Étapes suivantes

1. **Settings → Providers** : ajoutez une clé Mistral (active le RAG)
2. **Settings → Connecteurs** (optionnel) : PISTE et/ou Pappers
3. **Documents** : uploadez un PDF ou DOCX
4. **Conversations** : posez une question, joignez le document

## Production

Pour un déploiement production avec image Docker construite localement :

```bash
docker build -t louis:prod .
docker run --rm -p 3000:3000 --env-file .env.prod louis:prod
```

L'image bundle Next.js en mode `standalone` (~250 MB final). Pointer les
services externes (Postgres managé, Redis managé, S3, Gotenberg) via les
variables d'environnement — cf. [`../configuration/env-vars.md`](../configuration/env-vars.md).

Voir aussi [`../security/threat-model.md`](../security/threat-model.md)
pour les bonnes pratiques de durcissement.

## Dépannage

### Port 5433 déjà utilisé

Le `docker-compose.yml` mappe Postgres sur **5433** côté hôte (au lieu du
5432 standard) pour ne pas entrer en conflit avec un Postgres système.
Si 5433 est aussi pris, éditez `docker-compose.yml` et `.env`.

### "Aucun provider actif" sur /chat

Vous n'avez pas encore ajouté de clé provider IA. Allez sur
**Settings → Providers**, ajoutez votre clé Mistral / OpenAI / etc.

### RAG inactif (search_documents absent du chat)

Le RAG requiert une clé Mistral active (utilisée pour les embeddings).
Allez sur **Settings → Providers** et ajoutez votre clé Mistral.

### LibreOffice / Gotenberg

Le DocPanel utilise Gotenberg (lancé par docker-compose) pour le rendu
fidèle des DOCX. Si `GOTENBERG_URL` est vide dans `.env`, Louis tombe sur
le binaire LibreOffice local (à installer via `brew install --cask
libreoffice` sur macOS ou `apt install libreoffice` sur Debian), puis
sur une preview HTML mammoth (correcte mais moins fidèle).
