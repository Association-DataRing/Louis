"use client";

/**
 * Dernier filet : erreur dans le root layout lui-même. Doit fournir ses
 * propres <html>/<body> (il remplace le layout racine) et ne peut pas
 * dépendre des styles applicatifs → styles inline minimaux.
 */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fr">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, -apple-system, sans-serif",
          background: "#fff",
          color: "#1a1a2e",
        }}
      >
        <div style={{ textAlign: "center", padding: "2rem", maxWidth: 420 }}>
          <h1 style={{ fontSize: "1.4rem", margin: 0 }}>Erreur critique</h1>
          <p style={{ color: "#555", marginTop: "0.75rem", lineHeight: 1.5 }}>
            L&apos;application a rencontré une erreur inattendue. Rechargez la
            page ; si le problème persiste, contactez l&apos;administrateur.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "1.25rem",
              padding: "0.5rem 1rem",
              borderRadius: 6,
              border: "none",
              background: "#000091",
              color: "#fff",
              cursor: "pointer",
              fontSize: "0.9rem",
            }}
          >
            Recharger
          </button>
        </div>
      </body>
    </html>
  );
}
