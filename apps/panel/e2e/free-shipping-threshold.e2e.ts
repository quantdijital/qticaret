import type { Page } from "@playwright/test"
import { expect, test } from "./support/guard"

/**
 * Free shipping from a basket total (F4.5; the owner, 2026-11-26): set
 * in place under Settings > Shipping, then read on the promotions page,
 * whose link opens the same card. The shop's threshold is put back.
 */

const URL = "/admin/platform-settings/promotions"

async function threshold(page: Page): Promise<number | null> {
  const answer = await page.request.get(URL)
  expect(answer.ok()).toBe(true)
  return ((await answer.json()) as { values: { free_shipping_threshold: number | null } }).values
    .free_shipping_threshold
}

test.describe("free shipping threshold", () => {
  test("is set on the shipping page and shown on the promotions page", async ({ page, guard }) => {
    const before = await threshold(page)
    // Never the stored amount, so the card always has a change to save
    const [amount, typed, shown] =
      before === 1234.5 ? [1234, "1234", "₺1.234,00"] : [1234.5, "1234,50", "₺1.234,50"]
    try {
      await page.goto("/settings/shipping?part=options")
      const card = page.locator("#free-shipping")
      await expect(card.getByText("Ücretsiz kargo eşiği")).toBeVisible()
      const on = card.getByRole("switch", { name: "Belli bir tutardan sonra kargo bedava" })
      if ((await on.getAttribute("aria-checked")) !== "true") {
        await on.click()
      }
      await card.getByLabel("En az sepet tutarı").fill(typed)
      await card.getByRole("button", { name: "Kaydet" }).click()
      await expect.poll(() => threshold(page)).toBe(amount)

      await page.goto("/promotions")
      const summary = page.getByTestId("free-shipping-summary")
      await expect(summary).toHaveText(`Kargo bedava eşiği: ${shown}`)
      await page.getByRole("link", { name: "Kargo ayarlarında değiştir" }).click()
      await expect(page).toHaveURL(/\/settings\/shipping\?part=options#free-shipping$/)
      await expect(page.locator("#free-shipping").getByLabel("En az sepet tutarı")).toBeVisible()
      await guard.assertHealthy()
    } finally {
      const restored = await page.request.post(URL, { data: { free_shipping_threshold: before } })
      expect(restored.ok()).toBe(true)
    }
  })
})
