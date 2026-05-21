import type { Page } from "@playwright/test";

export const E2E_EMAIL = process.env.E2E_EMAIL ?? "admin@louis.local";
export const E2E_PASSWORD = process.env.E2E_PASSWORD ?? "password";

/**
 * Sign in with the seeded credentials. Throws if redirect to /dashboard does
 * not happen within the timeout — that means the seeded user is missing.
 */
export async function login(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel(/e-mail|email/i).fill(E2E_EMAIL);
  await page.getByLabel(/mot de passe|password/i).fill(E2E_PASSWORD);
  await page.getByRole("button", { name: /se connecter|sign in/i }).click();
  await page.waitForURL(/\/(dashboard|chat)/, { timeout: 10_000 });
}
