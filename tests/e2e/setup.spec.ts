import { test, expect } from "@playwright/test";

/**
 * Assistant de premier lancement (/setup).
 *
 * Ces tests ne s'exécutent que sur une instance FRAÎCHE (zéro utilisateur) :
 * sur une base déjà seedée, /login ne redirige pas vers /setup et la suite
 * entière est skippée. Pour les lancer localement :
 *
 *   docker exec louis-postgres psql -U louis -c "CREATE DATABASE louis_setup_e2e;"
 *   docker exec louis-postgres psql -U louis -d louis_setup_e2e -c "CREATE EXTENSION vector;"
 *   DATABASE_URL=postgresql://louis:louis@localhost:5433/louis_setup_e2e npx drizzle-kit push --force
 *   DATABASE_URL=postgresql://louis:louis@localhost:5433/louis_setup_e2e PORT=3210 npm run dev
 *   E2E_BASE_URL=http://localhost:3210 npx playwright test tests/e2e/setup.spec.ts
 *
 * L'ordre des tests compte (serial) : la création du compte verrouille /setup
 * pour les suivants.
 */
test.describe.configure({ mode: "serial" });

test.describe("Premier lancement (/setup)", () => {
  test.beforeEach(async ({ page }) => {
    const response = await page.goto("/login");
    const fresh = new URL(response?.url() ?? page.url()).pathname === "/setup";
    test.skip(!fresh && test.info().title.startsWith("instance fraîche"),
      "Instance déjà installée — wizard non testable.");
  });

  test("instance fraîche : login redirige vers /setup et le wizard complet fonctionne", async ({
    page,
  }) => {
    await expect(page).toHaveURL(/\/setup/);
    await expect(
      page.getByRole("heading", { name: /bienvenue sur louis/i })
    ).toBeVisible();

    // — Étape 1 : compte administrateur
    await page.getByLabel(/votre nom/i).fill("Test Admin");
    await page.getByLabel(/e-mail/i).fill("admin@louis.local");
    await page.getByLabel(/mot de passe/i).fill("correct-horse-battery");
    const submit = page.getByRole("button", { name: /créer mon compte/i });
    await expect(submit).toBeEnabled();
    await submit.click();

    // — Étape 2 : provider (grid visible, Mistral conseillé) — on diffère
    await expect(
      page.getByRole("heading", { name: /connectez votre intelligence/i })
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: /mistral/i }).first()).toBeVisible();
    await page.getByRole("button", { name: /plus tard/i }).click();

    // — Étape 3 : prêt, ouverture du tableau de bord (session déjà établie)
    await expect(
      page.getByRole("heading", { name: /louis est prêt/i })
    ).toBeVisible();
    await page
      .getByRole("button", { name: /ouvrir le tableau de bord/i })
      .click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });

    // La carte « Prise en main » persiste dans la sidebar (0/4 fait).
    await expect(page.getByText(/prise en main/i).first()).toBeVisible();
  });

  test("le chat sans provider propose le quick-add sans quitter la page", async ({
    page,
  }) => {
    // Session du test précédent perdue (nouveau contexte) → re-login.
    await page.goto("/login");
    if (/\/setup/.test(page.url())) test.skip(true, "Wizard non joué.");
    await page.getByLabel(/e-mail/i).fill("admin@louis.local");
    await page.getByLabel(/mot de passe/i).fill("correct-horse-battery");
    await page.getByRole("button", { name: /se connecter/i }).click();
    await page.waitForURL(/\/(dashboard|chat)/, { timeout: 10_000 });

    await page.goto("/chat");
    await expect(
      page.getByRole("heading", { name: /une clé, et louis s'éveille/i })
    ).toBeVisible();
    await page.getByRole("button", { name: /connecter une clé ia/i }).click();
    // Dialog quick-add : grid de providers + champ clé.
    await expect(
      page.getByRole("dialog").getByText(/connectez votre intelligence/i)
    ).toBeVisible();
    await expect(
      page.getByRole("dialog").getByLabel(/clé api/i)
    ).toBeVisible();
  });

  test("instance installée : /setup est verrouillé et redirige vers /login", async ({
    page,
  }) => {
    const response = await page.goto("/setup");
    expect(new URL(response?.url() ?? page.url()).pathname).toBe("/login");
  });
});
