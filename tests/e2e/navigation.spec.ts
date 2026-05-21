import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test.describe("Navigation principale (authentifié)", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  const pages: Array<{ path: string; heading: RegExp }> = [
    { path: "/dashboard", heading: /tableau de bord|dashboard/i },
    { path: "/chat", heading: /louis|conversation/i },
    { path: "/projects", heading: /projets/i },
    { path: "/documents", heading: /documents/i },
    { path: "/workflows", heading: /workflows/i },
    { path: "/tabular-reviews", heading: /analyses? tabulaires?/i },
    { path: "/usage", heading: /coûts|usage/i },
    { path: "/providers", heading: /providers/i },
    { path: "/connectors", heading: /connecteurs/i },
    { path: "/mcp", heading: /mcp|serveurs/i },
    { path: "/profile", heading: /profil/i },
  ];

  for (const { path, heading } of pages) {
    test(`${path} se charge`, async ({ page }) => {
      const resp = await page.goto(path);
      expect(resp?.status()).toBeLessThan(500);
      // Wait for at least one heading-ish element so we're not just measuring
      // the first byte from middleware.
      await expect(page.locator("h1").first()).toHaveText(heading, {
        timeout: 8_000,
      });
    });
  }
});

test.describe("Command Palette Cmd+K", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("Cmd+K ouvre la palette", async ({ page }) => {
    await page.goto("/dashboard");
    // Mac & Linux/Windows variants
    await page.keyboard.press("Meta+K");
    const dialog = page.getByRole("dialog");
    if (await dialog.isVisible().catch(() => false)) {
      await expect(dialog).toBeVisible();
    } else {
      await page.keyboard.press("Control+K");
      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 3_000 });
    }
  });
});
