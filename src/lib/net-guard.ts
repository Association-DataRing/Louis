/**
 * Garde SSRF pour les URL fournies par l'utilisateur (baseUrl d'un provider,
 * URL d'un serveur MCP). Le serveur Louis tourne dans le réseau du cabinet ;
 * sans contrôle, un membre pourrait lui faire interroger une cible interne
 * (endpoint de métadonnées cloud, panel d'admin du LAN…) et exfiltrer le
 * résultat via le comportement du modèle.
 *
 * Posture adaptée à un produit AUTO-HÉBERGÉ :
 * - On bloque TOUJOURS les adresses link-local / métadonnées cloud
 *   (169.254.0.0/16, fe80::/10) et les hôtes non spécifiés — jamais légitimes,
 *   cible SSRF n°1 (vol de credentials IAM via 169.254.169.254).
 * - On AUTORISE par défaut localhost et les plages privées (RFC1918) : c'est le
 *   cas d'usage central (Ollama/vLLM/LiteLLM sur la machine ou le LAN du
 *   cabinet). Les bloquer casserait la souveraineté.
 * - En déploiement mutualisé/hébergé, `LOUIS_SSRF_STRICT=1` bloque en plus
 *   localhost, RFC1918 et les ULA IPv6.
 *
 * Limite connue : on contrôle l'hôte littéral, pas la résolution DNS — un nom
 * d'hôte qui résout vers une IP privée (DNS rebinding) n'est pas attrapé ici.
 * Une protection complète demanderait de résoudre puis d'épingler l'IP ; hors
 * périmètre de ce garde-fou de premier niveau.
 */
export class SsrfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SsrfError";
  }
}

const ALWAYS_BLOCKED_HOSTS = new Set([
  "0.0.0.0",
  "::",
  "metadata.google.internal",
]);

/** 169.254.0.0/16 — link-local IPv4, inclut l'endpoint de métadonnées cloud. */
function isLinkLocalV4(host: string): boolean {
  return /^169\.254\.\d{1,3}\.\d{1,3}$/.test(host);
}

/** fe80::/10 — link-local IPv6. */
function isLinkLocalV6(host: string): boolean {
  return /^fe[89ab][0-9a-f]:/i.test(host);
}

/** RFC1918 + loopback IPv4. */
function isPrivateV4(host: string): boolean {
  return (
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^127\./.test(host)
  );
}

/** fc00::/7 — Unique Local Addresses IPv6. */
function isUlaV6(host: string): boolean {
  return /^f[cd][0-9a-f]{2}:/i.test(host);
}

function isStrict(): boolean {
  const v = process.env.LOUIS_SSRF_STRICT;
  return v === "1" || v === "true";
}

/**
 * Valide une URL fournie par l'utilisateur et la renvoie parsée. Lève une
 * SsrfError si le protocole n'est pas http(s) ou si l'hôte est interdit.
 */
export function assertSafeUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new SsrfError("URL invalide.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new SsrfError(
      `Protocole non autorisé (${url.protocol}) — utilisez http ou https.`
    );
  }

  const host = url.hostname.toLowerCase();
  // url.hostname garde les crochets pour l'IPv6 (« [fe80::1] ») — on les retire
  // pour comparer l'adresse littérale.
  const bare = host.replace(/^\[/, "").replace(/\]$/, "");

  if (
    ALWAYS_BLOCKED_HOSTS.has(bare) ||
    isLinkLocalV4(bare) ||
    isLinkLocalV6(bare)
  ) {
    throw new SsrfError(
      `Hôte interdit (${host}) : adresse link-local ou de métadonnées cloud.`
    );
  }

  if (isStrict() && (bare === "localhost" || isPrivateV4(bare) || isUlaV6(bare))) {
    throw new SsrfError(
      `Hôte privé interdit (${host}) — bloqué par LOUIS_SSRF_STRICT.`
    );
  }

  return url;
}
