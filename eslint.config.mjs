import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // ─── Ratchets structurels ────────────────────────────────────────────────
  // Garde-fous de dette : non-bloquants (warn) pour ne pas casser le build
  // (Next 16 ne lance pas ESLint au build, et `npm run lint` n'impose pas
  // --max-warnings), mais rendent visible toute dérive. Inspiré des ratchets
  // de vLLM Studio (max-lines + frontières d'import), ramenés au minimum sans
  // dépendance ESLint supplémentaire.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}"],
    rules: {
      // Au-delà de ~500 lignes, un fichier mélange en général plusieurs
      // responsabilités. 4 fichiers dépassent déjà ce seuil (chat-shell,
      // orchestrator, route chat, connectors/tools) — l'avertissement crée la
      // pression d'extraction sans imposer un refactor immédiat.
      "max-lines": [
        "warn",
        { max: 500, skipBlankLines: true, skipComments: true },
      ],
    },
  },
  // Frontière d'architecture : le cœur (`src/lib`) ne doit JAMAIS dépendre de
  // la couche UI/route (`src/app`) — la dépendance va dans l'autre sens. Aucune
  // violation existante, donc imposé en erreur pour verrouiller l'invariant.
  {
    files: ["src/lib/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/app/*", "@/app/**", "**/app/**"],
              message:
                "src/lib (cœur) ne doit pas importer src/app (UI/route). Inversez la dépendance : exposez la logique depuis lib et consommez-la depuis app.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
