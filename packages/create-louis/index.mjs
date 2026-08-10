#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Louis — installeur interactif (TUI)
//
//   npx -y github:Association-DataRing/Louis#installer
//
// Zéro dépendance (Node ≥ 18, built-ins uniquement). Guide l'installation de
// bout en bout dans le terminal :
//   1. vérifie / installe / démarre Docker ;
//   2. configure le dossier, le port, la version, l'IA souveraine ;
//   3. teste une clé provider et crée le compte administrateur ;
//   4. génère les secrets (.env), télécharge le compose, démarre la stack ;
//   5. ensemence l'admin + la clé via l'image « migrate », puis ouvre Louis.
//
// Mode non-interactif (CI / pipe) : passer `--yes` et les variables
// d'environnement LOUIS_* (voir --help). Relancer est sans danger : idempotent.
// ─────────────────────────────────────────────────────────────────────────────
import process from "node:process";
import readline from "node:readline";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  chmodSync,
} from "node:fs";
import { createServer } from "node:net";
import os from "node:os";
import path from "node:path";

const COMPOSE_FILE = "docker-compose.prod.yml";
const DEFAULT_REPO_RAW =
  "https://raw.githubusercontent.com/Association-DataRing/Louis/main";

// ── ANSI ─────────────────────────────────────────────────────────────────────
const useColor =
  process.stdout.isTTY && !process.env.NO_COLOR && process.env.TERM !== "dumb";
const paint = (open, close) => (s) =>
  useColor ? `\x1b[${open}m${s}\x1b[${close}m` : String(s);
const bold = paint(1, 22);
const dim = paint(2, 22);
const red = paint(31, 39);
const green = paint(32, 39);
const yellow = paint(33, 39);
const blue = paint(34, 39);
const cyan = paint(36, 39);
const gray = paint(90, 39);

const sym = {
  q: cyan("?"),
  ok: green("✓"),
  err: red("✗"),
  warn: yellow("⚠"),
  pointer: cyan("❯"),
  dot: gray("·"),
};

const out = (s = "") => process.stdout.write(s + "\n");
const step = (s) => out(`\n${bold(s)}`);
const info = (s) => out(`  ${s}`);
const okLine = (s) => out(`  ${sym.ok} ${s}`);
const warnLine = (s) => out(`  ${sym.warn} ${yellow(s)}`);
const errLine = (s) => process.stderr.write(`  ${sym.err} ${red(s)}\n`);

// ── Écran alterné ────────────────────────────────────────────────────────────
// L'installeur occupe tout le terminal (comme `less` ou `htop`) au lieu de
// s'empiler à la suite des commandes précédentes. À la sortie on restitue
// l'écran d'origine : le scrollback de l'utilisateur reste intact, et seul ce
// qui est écrit APRÈS exitFullscreen() persiste (récapitulatif, erreurs).
let altScreen = false;
function enterFullscreen() {
  if (altScreen || !process.stdout.isTTY || process.env.TERM === "dumb") return;
  altScreen = true;
  process.stdout.write("\x1b[?1049h\x1b[H\x1b[2J");
}
function exitFullscreen() {
  if (!altScreen) return;
  altScreen = false;
  process.stdout.write("\x1b[?1049l");
}
// Filet de sécurité : quelle que soit la sortie (die, throw, exit), on ne
// laisse jamais le terminal coincé dans l'écran alterné.
process.on("exit", exitFullscreen);

function die(msg) {
  exitFullscreen();
  errLine(msg);
  process.exit(1);
}

// ── Providers (miroir de src/lib/providers/catalog.ts) ───────────────────────
const PROVIDERS = [
  { type: "mistral", label: "Mistral", sovereignty: "FR", requiresBaseUrl: false, testBaseUrl: "https://api.mistral.ai/v1", authStyle: "bearer", docsUrl: "https://console.mistral.ai/api-keys/" },
  { type: "scaleway", label: "Scaleway Generative APIs", sovereignty: "FR", requiresBaseUrl: true, testBaseUrl: null, authStyle: "bearer", docsUrl: "https://console.scaleway.com/iam/api-keys", baseUrlPlaceholder: "https://api.scaleway.ai/VOTRE_PROJECT_ID/v1" },
  { type: "ovh", label: "OVHcloud AI Endpoints", sovereignty: "FR", requiresBaseUrl: true, testBaseUrl: null, authStyle: "bearer", docsUrl: "https://endpoints.ai.cloud.ovh.net/", baseUrlPlaceholder: "https://…endpoints.kepler.ai.cloud.ovh.net/api/openai_compat/v1" },
  { type: "albert", label: "Albert (Etalab)", sovereignty: "FR", requiresBaseUrl: false, testBaseUrl: "https://albert.api.etalab.gouv.fr/v1", authStyle: "bearer", docsUrl: "https://albert.api.etalab.gouv.fr/" },
  { type: "anthropic", label: "Anthropic", sovereignty: "US", requiresBaseUrl: false, testBaseUrl: "https://api.anthropic.com/v1", authStyle: "x-api-key", docsUrl: "https://console.anthropic.com/settings/keys" },
  { type: "openai", label: "OpenAI", sovereignty: "US", requiresBaseUrl: false, testBaseUrl: "https://api.openai.com/v1", authStyle: "bearer", docsUrl: "https://platform.openai.com/api-keys" },
  { type: "openai_compatible", label: "Endpoint OpenAI-compatible (Ollama, vLLM…)", sovereignty: "EU", requiresBaseUrl: true, testBaseUrl: null, authStyle: "bearer", docsUrl: "https://ollama.com/", baseUrlPlaceholder: "http://localhost:11434/v1" },
  { type: "openrouter", label: "OpenRouter", sovereignty: "US", requiresBaseUrl: false, testBaseUrl: "https://openrouter.ai/api/v1", authStyle: "bearer", docsUrl: "https://openrouter.ai/keys" },
];

// ── Modèles (miroir de src/lib/providers/models.ts) ──────────────────────────
// Le premier de chaque liste est le défaut (= DEFAULT_MODEL côté app), et il
// est proposé pré-sélectionné. On n'expose qu'une poignée d'entrées par
// provider : l'installeur sème le modèle choisi, le reste s'ajoute depuis
// Réglages › Modèles.
const MODELS = {
  mistral: [
    { id: "mistral-small-latest", label: "Mistral Small", hint: "Rapide, peu coûteux" },
    { id: "mistral-large-latest", label: "Mistral Large", hint: "Plus capable" },
  ],
  scaleway: [
    { id: "mistral-small-3-instruct-2503", label: "Mistral Small 3 (24B)" },
    { id: "llama-3.3-70b-instruct", label: "Llama 3.3 70B", hint: "Plus capable" },
  ],
  ovh: [
    { id: "Meta-Llama-3_1-8B-Instruct", label: "Llama 3.1 8B", hint: "Rapide" },
    { id: "Meta-Llama-3_1-70B-Instruct", label: "Llama 3.1 70B", hint: "Plus capable" },
  ],
  albert: [
    { id: "AgentPublic/llama3-instruct-8b", label: "Llama 3 Instruct 8B", hint: "Rapide" },
    { id: "AgentPublic/llama3-70b-instruct", label: "Llama 3 Instruct 70B", hint: "Plus capable" },
  ],
  anthropic: [
    { id: "claude-sonnet-4-7", label: "Claude Sonnet 4.7", hint: "Équilibré" },
    { id: "claude-opus-4-7", label: "Claude Opus 4.7", hint: "Plus capable" },
    { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", hint: "Rapide" },
  ],
  openai: [
    { id: "gpt-4o-mini", label: "GPT-4o mini", hint: "Rapide, peu coûteux" },
    { id: "gpt-4o", label: "GPT-4o", hint: "Plus capable" },
  ],
  openai_compatible: [
    { id: "gpt-3.5-turbo", label: "gpt-3.5-turbo (par défaut)" },
    { id: "llama3.1:8b", label: "Llama 3.1 8B (Ollama)" },
    { id: "mistral-small", label: "mistral-small (Ollama)" },
  ],
  openrouter: [
    { id: "anthropic/claude-sonnet-4.5", label: "Claude Sonnet 4.5", hint: "Équilibré" },
    { id: "openai/gpt-4o-mini", label: "GPT-4o mini", hint: "Rapide, peu coûteux" },
    { id: "mistralai/mistral-large", label: "Mistral Large", hint: "Souverain via OpenRouter" },
  ],
};

// ── CLI args ─────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const args = { yes: false, flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--yes" || a === "-y") args.yes = true;
    else if (a === "--help" || a === "-h") args.help = true;
    else if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        args.flags[key] = next;
        i++;
      } else {
        args.flags[key] = "true";
      }
    }
  }
  return args;
}

function conf(flags, flagName, envName, fallback) {
  if (flags[flagName] !== undefined) return flags[flagName];
  if (process.env[envName] !== undefined && process.env[envName] !== "")
    return process.env[envName];
  return fallback;
}

function printHelp() {
  out(`
${bold("create-louis")} — installeur interactif de Louis

${bold("Usage")}
  npx -y github:Association-DataRing/Louis#installer [options]

${bold("Options")}
  -y, --yes                Mode non-interactif (CI / pipe). Nécessite au moins
                           les identifiants admin ci-dessous pour tout finaliser.
  --dir <chemin>           Dossier d'installation           (défaut : ./louis)
  --port <n>               Port HTTP local                  (défaut : 3000, ou
                           le premier port libre au-dessus s'il est occupé)
  --model <id>             Modèle par défaut à activer      (défaut : le premier
                           du catalogue pour le provider choisi)
  --tag <version>          Tag d'image (ex. v0.2.0)         (défaut : latest)
  --repo-raw <url>         Base raw GitHub (fork / miroir)
  -h, --help               Affiche cette aide.

${bold("Variables d'environnement (surtout pour --yes)")}
  LOUIS_DIR, LOUIS_PORT, LOUIS_VERSION, LOUIS_REPO_RAW
  LOUIS_ADMIN_NAME, LOUIS_ADMIN_EMAIL, LOUIS_ADMIN_PASSWORD
  LOUIS_PROVIDER            type de provider (mistral, anthropic, openai, …)
  LOUIS_PROVIDER_KEY        clé API du provider
  LOUIS_PROVIDER_BASE_URL   base URL (Scaleway / OVH / endpoint compatible)
  LOUIS_MODEL               identifiant du modèle activé à l'installation

${bold("Exemples")}
  # Interactif
  npx -y github:Association-DataRing/Louis#installer

  # Non-interactif
  LOUIS_ADMIN_NAME="Marie Dupont" LOUIS_ADMIN_EMAIL=marie@cabinet.fr \\
  LOUIS_ADMIN_PASSWORD='motdepasse-tres-long' LOUIS_PROVIDER=mistral \\
  LOUIS_PROVIDER_KEY=sk-… \\
    npx -y github:Association-DataRing/Louis#installer --yes
`);
}

// ── Entrées interactives (raw mode + keypress) ───────────────────────────────
readline.emitKeypressEvents(process.stdin);

function rawOn() {
  if (process.stdin.isTTY) process.stdin.setRawMode(true);
  process.stdin.resume();
}
function rawOff() {
  if (process.stdin.isTTY) process.stdin.setRawMode(false);
  process.stdin.pause();
}
function bail() {
  rawOff();
  exitFullscreen();
  out("\n" + gray("Installation annulée."));
  process.exit(130);
}
function clearLines(n) {
  for (let i = 0; i < n; i++) process.stdout.write("\x1b[1A\x1b[2K");
}

/** Saisie texte (ligne), avec valeur par défaut et validation optionnelle. */
function textPrompt(question, { def = "", validate, mask = false } = {}) {
  return new Promise((resolve) => {
    let value = "";
    const hint = def ? dim(` (${def})`) : "";
    const render = () => {
      const shown = mask ? "•".repeat(value.length) : value;
      process.stdout.write(`\r\x1b[2K  ${sym.q} ${question}${hint}: ${shown}`);
    };
    render();
    rawOn();
    const onKey = (str, key) => {
      if (key.ctrl && key.name === "c") return bail();
      if (key.name === "return" || key.name === "enter") {
        const final = value.length ? value : def;
        if (validate) {
          const err = validate(final);
          if (err) {
            process.stdout.write("\n");
            errLine(err);
            value = "";
            render();
            return;
          }
        }
        cleanup();
        process.stdout.write("\n");
        return resolve(final);
      }
      if (key.name === "backspace") {
        value = value.slice(0, -1);
        return render();
      }
      if (str && !key.ctrl && !key.meta && str >= " ") {
        value += str;
        render();
      }
    };
    function cleanup() {
      process.stdin.off("keypress", onKey);
      rawOff();
    }
    process.stdin.on("keypress", onKey);
  });
}

/** Menu à flèches. options: [{ label, value, hint }]. */
function selectPrompt(question, options, { def = 0 } = {}) {
  return new Promise((resolve) => {
    let idx = def;
    out(`  ${sym.q} ${question}`);
    const paintMenu = () => {
      options.forEach((o, i) => {
        const active = i === idx;
        const pointer = active ? sym.pointer : " ";
        const label = active ? cyan(o.label) : o.label;
        const hint = o.hint ? dim("  " + o.hint) : "";
        process.stdout.write(`  ${pointer} ${label}${hint}\x1b[K\n`);
      });
    };
    paintMenu();
    rawOn();
    const onKey = (str, key) => {
      if (key.ctrl && key.name === "c") return bail();
      if (key.name === "up" || key.name === "k")
        idx = (idx - 1 + options.length) % options.length;
      else if (key.name === "down" || key.name === "j")
        idx = (idx + 1) % options.length;
      else if (key.name === "return" || key.name === "enter") {
        process.stdin.off("keypress", onKey);
        rawOff();
        clearLines(options.length + 1);
        out(`  ${sym.ok} ${question} ${dim("›")} ${cyan(options[idx].label)}`);
        return resolve(options[idx].value);
      } else return;
      process.stdout.write(`\x1b[${options.length}A`);
      paintMenu();
    };
    process.stdin.on("keypress", onKey);
  });
}

/** Question oui/non. */
async function confirmPrompt(question, { def = true } = {}) {
  const ans = await textPrompt(`${question} ${dim(def ? "[O/n]" : "[o/N]")}`, {
    def: def ? "o" : "n",
  });
  return /^(o|oui|y|yes)$/i.test(ans.trim());
}

// ── Spinner ──────────────────────────────────────────────────────────────────
function spinner(label) {
  if (!process.stdout.isTTY) {
    info(label + "…");
    return { stop() {}, succeed: (m) => okLine(m || label), fail: (m) => errLine(m || label) };
  }
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let i = 0;
  const timer = setInterval(() => {
    process.stdout.write(`\r  ${cyan(frames[i++ % frames.length])} ${label}…`);
  }, 80);
  const end = (mark, msg) => {
    clearInterval(timer);
    process.stdout.write(`\r\x1b[2K  ${mark} ${msg || label}\n`);
  };
  return {
    stop: () => {
      clearInterval(timer);
      process.stdout.write("\r\x1b[2K");
    },
    succeed: (m) => end(sym.ok, m),
    fail: (m) => end(sym.err, red(m || label)),
  };
}

// ── Secrets ──────────────────────────────────────────────────────────────────
const randSecret = () => randomBytes(32).toString("base64");
const randAlnum = () =>
  randomBytes(48).toString("base64").replace(/[/+=]/g, "").slice(0, 32);

// ── Réseau ───────────────────────────────────────────────────────────────────
function portFree(port) {
  return new Promise((resolve) => {
    const srv = createServer();
    srv.once("error", () => resolve(false));
    srv.once("listening", () => srv.close(() => resolve(true)));
    srv.listen(port, "127.0.0.1");
  });
}

// ── Détection de l'IA déjà présente sur la machine ───────────────────────────
// Beaucoup d'installations se font sur un poste qui a déjà un Ollama qui tourne
// ou une clé exportée dans l'environnement. Autant s'en servir plutôt que de
// faire saisir une clé à quelqu'un qui n'en a pas sous la main.
const ENV_KEY_VARS = {
  mistral: "MISTRAL_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
};
const OLLAMA_URL = "http://localhost:11434/v1";

/** Endpoint OpenAI-compatible local : renvoie les ids de modèles servis. */
async function probeLocalEndpoint(baseUrl) {
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 1500);
    const res = await fetch(`${baseUrl}/models`, { signal: c.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    const body = await res.json();
    const ids = (body?.data || []).map((m) => m?.id).filter(Boolean);
    return ids.length ? ids : null;
  } catch {
    return null;
  }
}

async function detectExisting() {
  const found = [];
  for (const [type, varName] of Object.entries(ENV_KEY_VARS)) {
    const key = process.env[varName]?.trim();
    if (key)
      found.push({
        kind: "env",
        meta: PROVIDERS.find((p) => p.type === type),
        apiKey: key,
        varName,
      });
  }
  const ids = await probeLocalEndpoint(OLLAMA_URL);
  if (ids)
    found.push({
      kind: "local",
      meta: PROVIDERS.find((p) => p.type === "openai_compatible"),
      baseUrl: OLLAMA_URL,
      models: ids,
    });
  return found;
}

/** Premier port libre à partir de `start` (20 essais, puis abandon). */
async function findFreePort(start) {
  for (let p = start + 1; p < start + 21 && p < 65536; p++) {
    if (await portFree(p)) return p;
  }
  return null;
}

async function testProviderKey(meta, apiKey, baseUrl) {
  const base = (baseUrl && baseUrl.trim()) || meta.testBaseUrl;
  if (!base) return "skipped";
  const headers =
    meta.authStyle === "x-api-key"
      ? { "x-api-key": apiKey, "anthropic-version": "2023-06-01" }
      : { Authorization: `Bearer ${apiKey}` };
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${base.replace(/\/$/, "")}/models`, {
      method: "GET",
      headers,
      signal: controller.signal,
    });
    clearTimeout(t);
    if (res.ok) return "ok";
    if (res.status === 401 || res.status === 403) return "auth_error";
    return "network_error";
  } catch {
    return "network_error";
  }
}

// ── Docker ───────────────────────────────────────────────────────────────────
let dockerCmd = ["docker"];

function runDocker(args, opts = {}) {
  return spawnSync(dockerCmd[0], [...dockerCmd.slice(1), ...args], {
    encoding: "utf8",
    ...opts,
  });
}
function dockerReady() {
  if (spawnSync("docker", ["info"], { stdio: "ignore" }).status === 0) {
    dockerCmd = ["docker"];
    return true;
  }
  if (
    process.platform !== "win32" &&
    spawnSync("sudo", ["-n", "docker", "info"], { stdio: "ignore" }).status === 0
  ) {
    dockerCmd = ["sudo", "docker"];
    return true;
  }
  return false;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForDocker() {
  if (dockerReady()) return true;
  if (process.platform === "darwin") {
    spawnSync("open", ["-a", "Docker"], { stdio: "ignore" });
  } else if (process.platform === "linux") {
    spawnSync("sudo", ["systemctl", "start", "docker"], { stdio: "ignore" });
    spawnSync("sudo", ["service", "docker", "start"], { stdio: "ignore" });
  } else if (process.platform === "win32") {
    for (const p of [
      `${process.env.ProgramFiles}\\Docker\\Docker\\Docker Desktop.exe`,
      `${process.env["ProgramFiles(x86)"]}\\Docker\\Docker\\Docker Desktop.exe`,
    ]) {
      if (p && existsSync(p)) {
        spawnSync("cmd", ["/c", "start", "", p], { stdio: "ignore" });
        break;
      }
    }
  }
  for (let i = 0; i < 90; i++) {
    if (dockerReady()) return true;
    await sleep(2000);
  }
  return false;
}

function installDocker() {
  if (process.platform === "darwin") {
    const sp = spinner("Installation de Docker Desktop (~600 Mo)");
    const arch = os.arch() === "arm64" ? "arm64" : "amd64";
    const script = `
set -e
url="https://desktop.docker.com/mac/main/${arch}/Docker.dmg"
dmg="$(mktemp -d)/Docker.dmg"
curl -fSL "$url" -o "$dmg"
mnt="$(mktemp -d)"
hdiutil attach "$dmg" -nobrowse -mountpoint "$mnt" >/dev/null
cp -R "$mnt/Docker.app" /Applications/
hdiutil detach "$mnt" >/dev/null 2>&1 || true
xattr -dr com.apple.quarantine /Applications/Docker.app 2>/dev/null || true
`;
    const r = spawnSync("sh", ["-c", script], { stdio: "inherit" });
    if (r.status !== 0) {
      sp.fail("Installation Docker échouée");
      die("Installez Docker manuellement : https://docs.docker.com/desktop/install/mac-install/");
    }
    sp.succeed("Docker Desktop installé");
  } else if (process.platform === "linux") {
    const sp = spinner("Installation de Docker Engine (script officiel)");
    const isRoot = typeof process.getuid === "function" && process.getuid() === 0;
    const cmd = isRoot
      ? "curl -fsSL https://get.docker.com | sh"
      : "curl -fsSL https://get.docker.com | sudo sh";
    const r = spawnSync("sh", ["-c", cmd], { stdio: "inherit" });
    if (r.status !== 0) {
      sp.fail("Installation Docker échouée");
      die("Installez Docker manuellement : https://docs.docker.com/engine/install/");
    }
    sp.succeed("Docker Engine installé");
  } else if (process.platform === "win32") {
    die(
      "Docker Desktop est introuvable. Installez-le puis relancez :\n" +
        "    https://docs.docker.com/desktop/install/windows-install/"
    );
  } else {
    die("OS non reconnu. Installez Docker : https://docs.docker.com/get-docker/");
  }
}

async function ensureDocker() {
  step("Docker");
  if (!commandExists("docker")) {
    warnLine("Docker n'est pas installé.");
    installDocker();
  }
  if (process.platform === "darwin")
    info(gray("Si une fenêtre Docker s'ouvre, cliquez « Accepter » pour finaliser."));
  const sp = spinner("Démarrage de Docker");
  const ready = await waitForDocker();
  if (!ready) {
    sp.fail("Docker ne répond pas");
    die(
      "Lancez Docker (Desktop), attendez que l'icône soit fixe, puis relancez cette commande."
    );
  }
  sp.succeed("Docker opérationnel");
  const cv = runDocker(["compose", "version"], { stdio: "ignore" });
  if (cv.status !== 0)
    die("Docker Compose v2 est absent. Mettez Docker Desktop à jour (il l'inclut).");
  if (dockerCmd[0] === "sudo")
    warnLine(
      "Docker tourne via sudo (groupe « docker » pas encore actif). Pour l'éviter : sudo usermod -aG docker \"$USER\" puis reconnectez-vous."
    );
}

function commandExists(cmd) {
  const probe =
    process.platform === "win32"
      ? spawnSync("where", [cmd], { stdio: "ignore" })
      : spawnSync("sh", ["-c", `command -v ${cmd}`], { stdio: "ignore" });
  return probe.status === 0;
}

function openBrowser(url) {
  try {
    if (process.platform === "darwin") spawnSync("open", [url], { stdio: "ignore" });
    else if (process.platform === "win32")
      spawnSync("cmd", ["/c", "start", "", url], { stdio: "ignore" });
    else spawnSync("xdg-open", [url], { stdio: "ignore" });
  } catch {
    /* best effort */
  }
}

// ── Génération .env + fichiers ───────────────────────────────────────────────
function writeEnvFile(envPath, cfg) {
  const now = new Date().toISOString();
  const lines = [
    "# Secrets Louis — générés le " + now,
    "# SAUVEGARDEZ CE FICHIER : ENCRYPTION_KEY est irremplaçable.",
    "POSTGRES_PASSWORD=" + randAlnum(),
    "S3_SECRET_ACCESS_KEY=" + randAlnum(),
    "AUTH_SECRET=" + randSecret(),
    "ENCRYPTION_KEY=" + randSecret(),
    "LOUIS_PORT=" + cfg.port,
  ];
  if (cfg.version && cfg.version !== "latest")
    lines.push("LOUIS_VERSION=" + cfg.version);
  if (cfg.embedding?.baseUrl) {
    lines.push("LOUIS_EMBEDDING_BASE_URL=" + cfg.embedding.baseUrl);
    lines.push("LOUIS_EMBEDDING_MODEL=" + (cfg.embedding.model || ""));
    lines.push("LOUIS_EMBEDDING_API_KEY=" + (cfg.embedding.apiKey || ""));
  }
  if (cfg.ssrfStrict) lines.push("LOUIS_SSRF_STRICT=1");
  writeFileSync(envPath, lines.join("\n") + "\n", { mode: 0o600 });
}

function writeUpdateScripts(dir) {
  const sh = `#!/usr/bin/env bash
# Met Louis à jour (image + redémarrage). Données et secrets (.env) conservés.
set -euo pipefail
cd "$(dirname "$0")"
DOCKER="docker"; docker info >/dev/null 2>&1 || DOCKER="sudo docker"
echo "Mise à jour de Louis…"
$DOCKER compose -f ${COMPOSE_FILE} pull
$DOCKER compose -f ${COMPOSE_FILE} up -d
echo "Louis est à jour."
`;
  writeFileSync(path.join(dir, "update.sh"), sh);
  chmodSync(path.join(dir, "update.sh"), 0o755);
  const ps = `$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
Write-Host "Mise a jour de Louis..."
docker compose -f ${COMPOSE_FILE} pull
docker compose -f ${COMPOSE_FILE} up -d
Write-Host "Louis est a jour."
`;
  writeFileSync(path.join(dir, "update.ps1"), ps);
}

async function downloadCompose(repoRaw, dest) {
  let res;
  try {
    res = await fetch(`${repoRaw}/${COMPOSE_FILE}`);
  } catch {
    // `fetch failed` tel quel n'aide personne : nommer la cause probable.
    throw new Error(`Impossible de joindre ${repoRaw} — vérifiez votre connexion Internet.`);
  }
  if (!res.ok)
    throw new Error(`Téléchargement de ${COMPOSE_FILE} impossible (HTTP ${res.status}).`);
  writeFileSync(dest, await res.text());
}

// ── Ensemencement admin + clé provider via l'image « migrate » ───────────────
function readEnvValue(envPath, key) {
  const line = readFileSync(envPath, "utf8")
    .split("\n")
    .find((l) => l.startsWith(key + "="));
  return line ? line.slice(key.length + 1) : "";
}

function seedSetup(installDir, admin, provider) {
  const encryptionKey = readEnvValue(path.join(installDir, ".env"), "ENCRYPTION_KEY");
  const envLines = [
    "ENCRYPTION_KEY=" + encryptionKey,
    "SEED_ADMIN_NAME=" + admin.name,
    "SEED_ADMIN_EMAIL=" + admin.email,
    "SEED_ADMIN_PASSWORD=" + admin.password,
  ];
  if (provider) {
    envLines.push("SEED_PROVIDER_TYPE=" + provider.type);
    envLines.push("SEED_PROVIDER_LABEL=" + provider.label);
    envLines.push("SEED_PROVIDER_API_KEY=" + provider.apiKey);
    envLines.push("SEED_PROVIDER_BASE_URL=" + (provider.baseUrl || ""));
    envLines.push("SEED_PROVIDER_TEST_STATUS=" + (provider.testStatus || "skipped"));
    if (provider.model) {
      envLines.push("SEED_MODEL_ID=" + provider.model.id);
      envLines.push("SEED_MODEL_LABEL=" + provider.model.label);
      envLines.push("SEED_MODEL_HINT=" + (provider.model.hint || ""));
    }
  }
  const tmp = path.join(os.tmpdir(), `louis-seed-${randomBytes(6).toString("hex")}.env`);
  writeFileSync(tmp, envLines.join("\n") + "\n", { mode: 0o600 });
  try {
    const r = runDocker(
      [
        "compose",
        "-f",
        COMPOSE_FILE,
        "run",
        "--rm",
        "--no-deps",
        // `docker compose run` n'a PAS de `--env-file` (contrairement à
        // `docker run`) : le flag est `--env-from-file` (Compose ≥ 2.24).
        "--env-from-file",
        tmp,
        "migrate",
        "npx",
        "tsx",
        "scripts/seed-setup.ts",
      ],
      { cwd: installDir, stdio: ["ignore", "pipe", "pipe"] }
    );
    return { ok: r.status === 0, output: (r.stdout || "") + (r.stderr || "") };
  } finally {
    rmSync(tmp, { force: true });
  }
}

// ── Flux principal ───────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return printHelp();

  const interactive = process.stdin.isTTY && !args.yes;
  if (!interactive && !args.yes && !process.stdin.isTTY) {
    die(
      "Terminal non interactif détecté. Relancez dans un vrai terminal, ou\n" +
        "  passez --yes avec les variables LOUIS_* (voir --help)."
    );
  }

  // L'écran alterné n'a de sens qu'en interactif : en CI (`--yes`) ou dans un
  // pipe, la sortie doit rester dans les logs.
  if (interactive) enterFullscreen();

  // Bannière
  out("");
  out(bold(cyan("  ██╗      ██████╗ ██╗   ██╗██╗███████╗")));
  out(bold(cyan("  ██║     ██╔═══██╗██║   ██║██║██╔════╝")));
  out(bold(cyan("  ██║     ██║   ██║██║   ██║██║███████╗")));
  out(bold(cyan("  ██║     ██║   ██║██║   ██║██║╚════██║")));
  out(bold(cyan("  ███████╗╚██████╔╝╚██████╔╝██║███████║")));
  out(bold(cyan("  ╚══════╝ ╚═════╝  ╚═════╝ ╚═╝╚══════╝")));
  out(dim("  L'IA juridique souveraine — installateur"));

  const repoRaw = conf(args.flags, "repo-raw", "LOUIS_REPO_RAW", DEFAULT_REPO_RAW);

  // 1. Docker
  await ensureDocker();

  // 2. Dossier
  step("Configuration");
  let dirInput = conf(args.flags, "dir", "LOUIS_DIR", "louis");
  if (interactive) {
    dirInput = await textPrompt("Dossier d'installation", { def: dirInput });
  }
  const installDir = path.resolve(dirInput);
  const envPath = path.join(installDir, ".env");
  const isUpdate = existsSync(envPath);

  if (isUpdate) {
    okLine(`Installation existante détectée dans ${installDir}`);
    info(gray("Mise à jour : configuration et secrets conservés."));
    mkdirSync(installDir, { recursive: true });
    const knownPort = readEnvValue(envPath, "LOUIS_PORT") || "3000";
    await refreshAndStart(installDir, repoRaw, knownPort, true);
    done(knownPort, { update: true });
    return;
  }

  // Port : plus jamais demandé. Un cabinet d'avocats n'a pas à savoir ce
  // qu'est un port HTTP — 3000 par défaut, et on glisse au suivant libre s'il
  // est occupé. `--port` / LOUIS_PORT restent là pour les cas explicites.
  const portExplicit =
    args.flags.port !== undefined || !!process.env.LOUIS_PORT;
  let port = String(conf(args.flags, "port", "LOUIS_PORT", "3000"));
  if (!(await portFree(+port))) {
    const free = portExplicit ? null : await findFreePort(+port);
    if (free) {
      warnLine(`Le port ${port} est occupé — Louis utilisera le ${free}.`);
      port = String(free);
    } else {
      warnLine(`Le port ${port} semble déjà utilisé — poursuite quand même (Docker le signalera si conflit).`);
    }
  }

  // Version
  const version = conf(args.flags, "tag", "LOUIS_VERSION", "latest");

  // Options avancées (souveraineté). Elles étaient auparavant joignables
  // UNIQUEMENT en interactif : en `--yes`, LOUIS_EMBEDDING_* et
  // LOUIS_SSRF_STRICT étaient silencieusement ignorés alors que le compose
  // les consomme. On les lit ici, les prompts interactifs restent prioritaires.
  const cfg = { port, version, embedding: null, ssrfStrict: false };
  const envEmbedBase = conf(args.flags, "embedding-base-url", "LOUIS_EMBEDDING_BASE_URL", "");
  if (envEmbedBase) {
    cfg.embedding = {
      baseUrl: envEmbedBase,
      model: conf(args.flags, "embedding-model", "LOUIS_EMBEDDING_MODEL", ""),
      apiKey: conf(args.flags, "embedding-api-key", "LOUIS_EMBEDDING_API_KEY", ""),
    };
  }
  cfg.ssrfStrict = ["1", "true"].includes(
    String(conf(args.flags, "ssrf-strict", "LOUIS_SSRF_STRICT", "")).toLowerCase()
  );
  if (interactive && (await confirmPrompt("Configurer les options avancées (IA souveraine, durcissement) ?", { def: false }))) {
    if (await confirmPrompt("Utiliser un backend d'embedding auto-hébergé (Ollama/vLLM/TEI) ?", { def: false })) {
      const baseUrl = await textPrompt("  Embedding — base URL (OpenAI-compatible)", { def: "http://localhost:11434/v1" });
      const model = await textPrompt("  Embedding — modèle (vecteurs de dimension 1024)", { def: "" });
      const apiKey = await textPrompt("  Embedding — clé API (vide si aucune)", { def: "", mask: true });
      cfg.embedding = { baseUrl, model, apiKey };
    }
    cfg.ssrfStrict = await confirmPrompt("Durcir la garde SSRF (déploiement mutualisé — bloque localhost/LAN) ?", { def: false });
  }

  // 3. Provider IA (optionnel)
  const provider = await collectProvider(args, interactive);

  // 4. Compte admin
  const admin = await collectAdmin(args, interactive);

  // 5. Écriture des fichiers
  step("Préparation");
  mkdirSync(installDir, { recursive: true });
  const sp = spinner("Téléchargement du docker-compose");
  try {
    await downloadCompose(repoRaw, path.join(installDir, COMPOSE_FILE));
    sp.succeed(`${COMPOSE_FILE} à jour`);
  } catch (e) {
    sp.fail(e.message);
    process.exit(1);
  }
  writeEnvFile(envPath, cfg);
  writeUpdateScripts(installDir);
  okLine(`Secrets générés dans ${gray(envPath)}`);
  warnLine("Sauvegardez ce .env : ENCRYPTION_KEY chiffre vos clés et est irremplaçable.");

  // 6. Démarrage + attente
  await refreshAndStart(installDir, repoRaw, port, false);

  // 7. Ensemencement admin + clé
  let seeded = false;
  let seedNote = null;
  if (admin) {
    const sp2 = spinner("Création du compte administrateur");
    const res = seedSetup(installDir, admin, provider);
    if (res.ok) {
      seeded = true;
      sp2.succeed(
        provider
          ? "Compte administrateur et clé IA enregistrés"
          : "Compte administrateur créé"
      );
    } else {
      sp2.fail("Compte non créé — l'assistant du navigateur prendra le relais");
      // L'image `migrate` embarque scripts/seed-setup.ts depuis la v0.2.2. Sur
      // une image antérieure, tsx échoue sur un module introuvable : le dire
      // franchement plutôt que de recracher une stack trace tronquée. Le motif
      // est gardé pour le récapitulatif final : tout ce qui est écrit ici part
      // avec l'écran alterné, et l'utilisateur ne verrait rien.
      seedNote = /seed-setup\.ts|ERR_MODULE_NOT_FOUND/.test(res.output)
        ? "Cause : l'image Docker publiée est antérieure à l'ensemencement (aucune version taguée depuis)."
        : res.output.trim().split("\n").filter(Boolean).slice(-2).join(" ").slice(0, 200) ||
          null;
    }
  }

  // 8. Fin — on annonce ce qui a RÉELLEMENT été fait, pas ce qui a été saisi.
  done(port, {
    admin: seeded,
    provider: seeded && !!provider,
    seedFailed: !!admin && !seeded,
    seedNote,
  });
}

async function collectProvider(args, interactive) {
  const envType = conf(args.flags, "provider", "LOUIS_PROVIDER", "");
  const envKey = conf(args.flags, "provider-key", "LOUIS_PROVIDER_KEY", "");
  const envBase = conf(args.flags, "provider-base-url", "LOUIS_PROVIDER_BASE_URL", "");

  if (!interactive) {
    if (!envType || !envKey) return null;
    const meta = PROVIDERS.find((p) => p.type === envType);
    if (!meta) die(`Provider inconnu : ${envType}. Valeurs : ${PROVIDERS.map((p) => p.type).join(", ")}.`);
    const testStatus = await testProviderKey(meta, envKey, envBase);
    if (testStatus === "auth_error") die("Le provider a refusé la clé fournie (LOUIS_PROVIDER_KEY).");
    const envModel = conf(args.flags, "model", "LOUIS_MODEL", "");
    const model = envModel
      ? { id: envModel, label: envModel, hint: "" }
      : MODELS[meta.type]?.[0] || null;
    return { type: meta.type, label: meta.label, apiKey: envKey, baseUrl: envBase, testStatus, model };
  }

  step("Intelligence (IA)");
  info(dim("Louis fonctionne avec vos propres clés — elles ne quittent jamais votre instance."));

  const spDetect = spinner("Détection de l'IA déjà présente sur cette machine");
  const detected = await detectExisting();
  if (detected.length) spDetect.succeed(`${detected.length} source(s) d'IA détectée(s)`);
  else spDetect.stop();

  const choice = await selectPrompt("Connecter un provider maintenant ?", [
    ...detected.map((d) => ({
      label:
        d.kind === "env"
          ? `Utiliser ${d.meta.label} — clé trouvée dans ${d.varName}`
          : `Utiliser Ollama détecté sur localhost:11434`,
      value: d,
      hint: d.meta.sovereignty,
    })),
    { label: detected.length ? "Choisir un autre provider" : "Oui, choisir un provider", value: "yes" },
    { label: "Plus tard (dans le navigateur)", value: "no", hint: "à configurer après" },
  ]);
  if (choice === "no") return null;
  if (choice !== "yes") {
    const fromDetected = await adoptDetected(choice);
    if (fromDetected) return fromDetected;
    // Détection refusée par le provider : on retombe sur la saisie manuelle.
  }

  const meta = await selectPrompt(
    "Provider",
    PROVIDERS.map((p) => ({ label: p.label, value: p, hint: p.sovereignty }))
  );
  info(gray(`Clé : ${meta.docsUrl}`));
  let baseUrl = "";
  if (meta.requiresBaseUrl) {
    baseUrl = await textPrompt("Base URL", {
      def: meta.baseUrlPlaceholder || "",
      validate: (v) => (/^https?:\/\//.test(v) ? null : "URL http(s) requise."),
    });
  }
  // Boucle : re-demander si la clé est refusée.
  for (;;) {
    const apiKey = await textPrompt("Clé API", {
      mask: true,
      validate: (v) => (v.trim() ? null : "Clé requise."),
    });
    const sp = spinner("Test de la clé");
    const status = await testProviderKey(meta, apiKey, baseUrl);
    if (status === "ok") sp.succeed("Clé valide");
    else if (status === "skipped") sp.succeed("Clé enregistrée (test non disponible pour ce provider)");
    else if (status === "auth_error") {
      sp.fail("Le provider a refusé cette clé — vérifiez et réessayez");
      continue;
    } else {
      sp.fail("Provider injoignable pour vérifier la clé");
      if (!(await confirmPrompt("Enregistrer la clé sans test ?", { def: true }))) continue;
    }
    return {
      type: meta.type,
      label: meta.label,
      apiKey,
      baseUrl,
      testStatus: status,
      model: await collectModel(meta.type),
    };
  }
}

/**
 * Utilise une source d'IA détectée (clé d'environnement ou Ollama local).
 * Renvoie null si le provider refuse la clé — l'appelant repart alors sur la
 * saisie manuelle.
 */
// Nommée `adoptDetected` et non `useDetected` : le préfixe `use` fait passer
// la fonction pour un hook React aux yeux de react-hooks/rules-of-hooks, qui
// lint aussi ce paquet.
async function adoptDetected(d) {
  // Ollama ignore l'authentification, mais Louis stocke toujours une clé.
  const apiKey = d.apiKey || "ollama";
  const sp = spinner(`Vérification de ${d.meta.label}`);
  const status = await testProviderKey(d.meta, apiKey, d.baseUrl || "");
  if (status === "auth_error") {
    sp.fail(`${d.varName || d.meta.label} a été refusée — saisie manuelle`);
    return null;
  }
  sp.succeed(status === "ok" ? "Connexion vérifiée" : "Enregistrée (test indisponible)");

  // Endpoint local : on propose les modèles réellement servis, pas un catalogue.
  const model = await collectModel(d.meta.type, d.models);

  return {
    type: d.meta.type,
    label: d.meta.label,
    apiKey,
    baseUrl: d.baseUrl || "",
    testStatus: status,
    model,
  };
}

/**
 * Choix du modèle par défaut. Sans ça le compte démarre avec une clé mais
 * un sélecteur de modèles VIDE (`model_settings` est opt-in côté app), donc
 * impossible de converser sans passer par les réglages.
 */
async function collectModel(providerType, liveModels = null) {
  // `liveModels` : ids réellement servis par un endpoint détecté. Ils priment
  // sur le catalogue, mais gardent l'échappatoire « Autre » — sinon on
  // enferme l'utilisateur dans ce qu'Ollama sert à l'instant T.
  const catalog = liveModels
    ? liveModels.slice(0, 8).map((id) => ({ id, label: id }))
    : MODELS[providerType] || [];
  const custom = { label: "Autre — saisir l'identifiant", value: null };
  const picked = await selectPrompt(
    "Modèle par défaut",
    [...catalog.map((m) => ({ label: m.label, value: m, hint: m.hint })), custom]
  );
  if (picked) return picked;
  const id = await textPrompt("Identifiant du modèle", {
    validate: (v) => (v.trim() ? null : "Identifiant requis."),
  });
  return { id: id.trim(), label: id.trim(), hint: "" };
}

async function collectAdmin(args, interactive) {
  const name = conf(args.flags, "admin-name", "LOUIS_ADMIN_NAME", "");
  const email = conf(args.flags, "admin-email", "LOUIS_ADMIN_EMAIL", "");
  const password = conf(args.flags, "admin-password", "LOUIS_ADMIN_PASSWORD", "");

  const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  if (!interactive) {
    if (!email || !password) {
      warnLine("Identifiants admin absents — le compte se créera dans le navigateur (/setup).");
      return null;
    }
    if (!emailOk(email)) die("LOUIS_ADMIN_EMAIL invalide.");
    if (password.length < 12) die("LOUIS_ADMIN_PASSWORD : 12 caractères minimum.");
    return { name: name || "Admin", email, password };
  }

  step("Compte administrateur");
  info(dim("Ce compte contrôle les membres, les quotas et la configuration."));
  const aName = await textPrompt("Votre nom", {
    def: name || "",
    validate: (v) => (v.trim() ? null : "Nom requis."),
  });
  const aEmail = await textPrompt("Adresse e-mail", {
    def: email || "",
    validate: (v) => (emailOk(v) ? null : "E-mail invalide."),
  });
  let aPass;
  for (;;) {
    aPass = await textPrompt("Mot de passe (12 caractères min.)", {
      mask: true,
      validate: (v) => (v.length >= 12 ? null : `Trop court — ${Math.max(0, 12 - v.length)} caractère(s) manquant(s).`),
    });
    const confirm = await textPrompt("Confirmer le mot de passe", { mask: true });
    if (confirm === aPass) break;
    errLine("Les mots de passe ne correspondent pas — réessayez.");
  }
  return { name: aName, email: aEmail, password: aPass };
}

async function refreshAndStart(installDir, repoRaw, port, isUpdate) {
  step(isUpdate ? "Mise à jour" : "Démarrage");
  if (isUpdate) {
    // Rafraîchit le compose (aucun secret dedans).
    const sp = spinner("Rafraîchissement du docker-compose");
    try {
      await downloadCompose(repoRaw, path.join(installDir, COMPOSE_FILE));
      sp.succeed(`${COMPOSE_FILE} à jour`);
    } catch (e) {
      sp.fail(e.message);
    }
    writeUpdateScripts(installDir);
  }

  // ponytail: pas de spinner ici — `docker compose pull` écrit sa propre
  // barre de progression sur le même terminal (stdio: inherit) et les deux
  // se marchent dessus. Une ligne d'attente suffit.
  info(gray("Téléchargement des images (premier lancement : quelques minutes)…"));
  const pull = runDocker(["compose", "-f", COMPOSE_FILE, "pull"], {
    cwd: installDir,
    stdio: "inherit",
  });
  if (pull.status !== 0) die("Échec du téléchargement des images Docker.");
  const up = runDocker(["compose", "-f", COMPOSE_FILE, "up", "-d"], {
    cwd: installDir,
    stdio: "inherit",
  });
  if (up.status !== 0) die("Échec du démarrage de la stack (docker compose up).");
  okLine("Stack démarrée");

  const sp = spinner("Démarrage de Louis (application du schéma + app)");
  const url = `http://localhost:${port}/api/health`;
  for (let i = 0; i < 90; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        sp.succeed(`Louis répond sur http://localhost:${port}`);
        return;
      }
    } catch {
      /* pas encore prêt */
    }
    await sleep(2000);
  }
  sp.fail("Louis ne répond pas");
  die(
    `Diagnostic : cd ${installDir} && ${dockerCmd.join(" ")} compose -f ${COMPOSE_FILE} logs app migrate`
  );
}

function done(port, { admin, provider, update = false, seedFailed = false, seedNote = null }) {
  // Le récapitulatif doit survivre à l'installeur : on rend la main au terminal
  // d'origine AVANT de l'écrire, sinon il disparaît avec l'écran alterné.
  exitFullscreen();
  const url = `http://localhost:${port}`;
  out("");
  out(`  ${green("●")} ${bold(update ? "Mise à jour terminée." : "Installation terminée.")}`);
  out("");
  if (update) {
    info(`Louis est à jour. Ouvrez ${cyan(url)} — vos données et vos réglages sont intacts.`);
  } else if (admin && provider) {
    info("Tout est prêt : compte administrateur et clé IA en place.");
    info(`Ouvrez ${cyan(url)} et connectez-vous pour commencer à converser.`);
  } else if (admin) {
    info("Compte administrateur créé. Connectez une clé IA depuis les réglages.");
    info(`Ouvrez ${cyan(url)} et connectez-vous.`);
  } else if (seedFailed) {
    // Ce que l'utilisateur a saisi a été perdu : le dire ici, en toutes lettres,
    // plutôt que de le laisser croire que /setup n'est qu'une formalité.
    warnLine("Le compte et la clé IA que vous avez saisis n'ont PAS été enregistrés.");
    if (seedNote) info(gray(seedNote));
    info(`Ouvrez ${cyan(url)} : l'assistant de premier lancement vous les redemandera.`);
  } else {
    info(`Ouvrez ${cyan(url)} — l'assistant de premier lancement vous guide`);
    info("(compte administrateur, première clé IA).");
  }
  out("");
  info(dim(`Mettre à jour : relancez cette commande, ou ${path.join("louis", "update.sh")}`));
  info(dim(`Arrêt : docker compose -f ${COMPOSE_FILE} down`));
  openBrowser(url);
  process.exit(0);
}

// `process.on("exit")` ne voit pas les signaux : sans ces deux handlers, un
// `kill` laisserait le terminal bloqué dans l'écran alterné.
process.on("SIGINT", () => bail());
process.on("SIGTERM", () => bail());

main().catch((err) => {
  rawOff();
  exitFullscreen();
  errLine(err?.stack || String(err));
  process.exit(1);
});
