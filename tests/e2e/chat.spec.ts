import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test.describe("Chat (UI seulement, sans LLM)", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("composer accepte une saisie", async ({ page }) => {
    await page.goto("/chat");
    const composer = page
      .locator("textarea, [contenteditable='true']")
      .first();
    await expect(composer).toBeVisible({ timeout: 8_000 });
    await composer.fill("Bonjour Louis, ceci est un test E2E");
    await expect(composer).toHaveValue(/test E2E/);
  });

  test("liste des conversations visible dans la sidebar", async ({ page }) => {
    await page.goto("/chat");
    // Sidebar header "Conversations" (small uppercase label)
    await expect(page.getByText(/conversations/i).first()).toBeVisible();
  });
});
