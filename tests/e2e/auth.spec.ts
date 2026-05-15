import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test.describe("Authentification", () => {
  test("page login s'affiche", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel(/e-mail/i)).toBeVisible();
    await expect(page.getByLabel(/mot de passe/i)).toBeVisible();
  });

  test("redirige vers /login quand non authentifié", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("login -> dashboard accessible", async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/\/(dashboard|chat)/);
  });

  test("mauvais mot de passe -> reste sur login", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/e-mail/i).fill("admin@louis.local");
    await page.getByLabel(/mot de passe/i).fill("wrong-password-xyz");
    await page.getByRole("button", { name: /se connecter/i }).click();
    // We don't redirect — error inline. Give NextAuth a beat.
    await page.waitForTimeout(800);
    await expect(page).toHaveURL(/\/login/);
  });
});
