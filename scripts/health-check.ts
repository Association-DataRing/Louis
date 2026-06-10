/**
 * Pré-vol avant installation ou mise à jour : valide l'environnement complet
 * en une commande, avec des messages actionnables (pensé pour un opérateur
 * non-développeur — hébergeur partenaire, IT de cabinet).
 *
 *   npm run health-check
 *
 * Vérifie : version Node, secrets requis (.env), Postgres + extension
 * pgvector, Redis, stockage S3/MinIO, Gotenberg (optionnel), espace disque.
 * Code de sortie ≠ 0 si au moins un check bloquant échoue.
 */
import "dotenv/config";
import { execFileSync } from "node:child_process";
import { sql } from "drizzle-orm";

type Check = {
  name: string;
  /** false = avertissement seulement (n'affecte pas le code de sortie). */
  blocking: boolean;
  run: () => Promise<string>;
};

const ok = (msg: string) => `\x1b[32m✓\x1b[0m ${msg}`;
const ko = (msg: string) => `\x1b[31m✗\x1b[0m ${msg}`;
const warn = (msg: string) => `\x1b[33m⚠\x1b[0m ${msg}`;

const checks: Check[] = [
  {
    name: "Node.js",
    blocking: true,
    run: async () => {
      const major = Number(process.versions.node.split(".")[0]);
      if (major < 24) {
        throw new Error(
          `Node ${process.versions.node} détecté — Louis requiert Node 24+. Installez la LTS : https://nodejs.org`
        );
      }
      return `Node ${process.versions.node}`;
    },
  },
  {
    name: "Secrets",
    blocking: true,
    run: async () => {
      const missing = ["DATABASE_URL", "AUTH_SECRET", "ENCRYPTION_KEY"].filter(
        (k) => !process.env[k]
      );
      if (missing.length > 0) {
        throw new Error(
          `Variable(s) manquante(s) dans .env : ${missing.join(", ")}. Générez les secrets avec : openssl rand -base64 32`
        );
      }
      if ((process.env.AUTH_SECRET ?? "").length < 32) {
        throw new Error(
          "AUTH_SECRET trop court (< 32 caractères) — régénérez avec : openssl rand -base64 32"
        );
      }
      return "DATABASE_URL, AUTH_SECRET, ENCRYPTION_KEY présents";
    },
  },
  {
    name: "PostgreSQL",
    blocking: true,
    run: async () => {
      const { db } = await import("../src/db");
      await db.execute(sql`SELECT 1`);
      const rows = await db.execute(
        sql`SELECT extname FROM pg_extension WHERE extname = 'vector'`
      );
      const hasVector = (rows as unknown as { length?: number }).length !== 0;
      if (!hasVector) {
        throw new Error(
          "Postgres répond mais l'extension pgvector est absente — lancez : npm run db:setup"
        );
      }
      return "connexion OK, extension pgvector active";
    },
  },
  {
    name: "Redis",
    blocking: true,
    run: async () => {
      const { getRedis } = await import("../src/lib/redis");
      const r = getRedis();
      // getRedis() lance la connexion (lazyConnect) — on attend l'état
      // ready avant d'émettre la commande (offline queue désactivée).
      if (r.status !== "ready") {
        await new Promise<void>((resolve, reject) => {
          const t = setTimeout(
            () =>
              reject(
                new Error(
                  `connexion impossible en 5 s (${process.env.REDIS_URL ?? "redis://localhost:6379"}) — vérifiez que le conteneur Redis tourne (docker compose ps).`
                )
              ),
            5000
          );
          r.once("ready", () => {
            clearTimeout(t);
            resolve();
          });
          r.once("error", (e) => {
            clearTimeout(t);
            reject(
              new Error(
                `injoignable (${e instanceof Error ? e.message : String(e)}) — vérifiez REDIS_URL et que le conteneur Redis tourne.`
              )
            );
          });
        });
      }
      const pong = await r.ping();
      if (pong !== "PONG") throw new Error(`réponse inattendue : ${pong}`);
      return "PING → PONG";
    },
  },
  {
    name: "Stockage S3",
    blocking: true,
    run: async () => {
      const endpoint = process.env.S3_ENDPOINT;
      if (!endpoint) {
        throw new Error(
          "S3_ENDPOINT absent du .env — l'upload de documents échouera. MinIO local : http://localhost:9000"
        );
      }
      const res = await fetch(`${endpoint.replace(/\/$/, "")}/minio/health/live`, {
        signal: AbortSignal.timeout(5000),
      }).catch(() => null);
      // Hors MinIO (Scaleway/OVH/AWS), l'endpoint santé n'existe pas : on
      // tente alors un simple HEAD sur la racine (toute réponse HTTP suffit
      // à prouver que l'endpoint est joignable).
      if (res?.ok) return `MinIO joignable (${endpoint})`;
      const head = await fetch(endpoint, {
        method: "HEAD",
        signal: AbortSignal.timeout(5000),
      }).catch(() => null);
      if (!head) {
        throw new Error(
          `${endpoint} injoignable — vérifiez que le conteneur MinIO tourne (docker compose ps) ou l'URL de votre stockage objet.`
        );
      }
      return `endpoint joignable (${endpoint})`;
    },
  },
  {
    name: "Gotenberg",
    blocking: false,
    run: async () => {
      const url = process.env.GOTENBERG_URL;
      if (!url) {
        throw new Error(
          "GOTENBERG_URL absent — l'aperçu PDF fidèle des DOCX sera dégradé (fallback mammoth). Optionnel."
        );
      }
      const res = await fetch(`${url.replace(/\/$/, "")}/health`, {
        signal: AbortSignal.timeout(5000),
      }).catch(() => null);
      if (!res?.ok) {
        throw new Error(
          `${url} injoignable — l'aperçu PDF fidèle des DOCX sera dégradé. Optionnel.`
        );
      }
      return `joignable (${url})`;
    },
  },
  {
    name: "Espace disque",
    blocking: false,
    run: async () => {
      try {
        const out = execFileSync("df", ["-Pk", "."], { encoding: "utf-8" });
        const freeKb = Number(out.trim().split("\n").at(-1)?.split(/\s+/)[3]);
        const freeGb = freeKb / 1024 / 1024;
        if (freeGb < 1) {
          throw new Error(
            `${freeGb.toFixed(1)} Go libres — moins de 1 Go, les uploads et les images Docker risquent d'échouer.`
          );
        }
        return `${freeGb.toFixed(1)} Go libres`;
      } catch (err) {
        if (err instanceof Error && err.message.includes("Go libres")) throw err;
        throw new Error("mesure impossible (df indisponible). Optionnel.");
      }
    },
  },
];

async function main() {
  console.log("Louis — pré-vol d'installation / mise à jour\n");
  let blockingFailures = 0;

  for (const check of checks) {
    try {
      const detail = await check.run();
      console.log(`${ok(check.name)} — ${detail}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (check.blocking) {
        blockingFailures++;
        console.log(`${ko(check.name)} — ${msg}`);
      } else {
        console.log(`${warn(check.name)} — ${msg}`);
      }
    }
  }

  console.log(
    blockingFailures === 0
      ? "\n\x1b[32mPrêt.\x1b[0m Tous les checks bloquants passent."
      : `\n\x1b[31m${blockingFailures} check(s) bloquant(s) en échec.\x1b[0m Corrigez avant d'installer ou de mettre à jour.`
  );
  process.exit(blockingFailures === 0 ? 0 : 1);
}

main();
