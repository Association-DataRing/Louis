/**
 * Logger minimaliste — sans dépendance externe.
 *
 * Production : JSON ligne-par-ligne, parseable par Loki / Datadog / journald.
 * Développement : `[level] [scope] message {meta}` lisible humainement.
 *
 * Pourquoi pas pino : pour Louis v0.1 (self-hosted, mono-instance, volumes
 * de logs modestes), la valeur ajoutée de pino (perf, transports) ne
 * justifie pas les 700 kB ajoutés au bundle. On peut bumper plus tard sans
 * changer l'API : `log.warn("scope", message, meta)`.
 */

const isProd = process.env.NODE_ENV === "production";

type Level = "debug" | "info" | "warn" | "error";

function emit(level: Level, scope: string, message: string, meta?: unknown) {
  if (isProd) {
    process.stdout.write(
      JSON.stringify({
        level,
        scope,
        message,
        ...(meta && typeof meta === "object" ? { meta } : meta ? { meta } : {}),
        timestamp: new Date().toISOString(),
      }) + "\n"
    );
  } else {
    const prefix = `[${level}] [${scope}]`;
    if (meta !== undefined) {
      const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
      fn(prefix, message, meta);
    } else {
      const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
      fn(prefix, message);
    }
  }
}

export const log = {
  debug: (scope: string, message: string, meta?: unknown) =>
    emit("debug", scope, message, meta),
  info: (scope: string, message: string, meta?: unknown) =>
    emit("info", scope, message, meta),
  warn: (scope: string, message: string, meta?: unknown) =>
    emit("warn", scope, message, meta),
  error: (scope: string, message: string, meta?: unknown) =>
    emit("error", scope, message, meta),
};
