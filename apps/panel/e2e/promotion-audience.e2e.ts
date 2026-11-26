import type { Page } from "@playwright/test"
import { expect, pageHeading, test } from "./support/guard"

/**
 * Who may use a coupon (K1/K2, WooCommerce's usage restrictions): "İlk
 * siparişe özel" switched on in the conditions card, said in the preview,
 * saved and there again after a reload, then off again. The test makes
 * its own draft promotion and deletes it at the end: nothing of the shop's
 * own changes.
 */

interface PromotionRead {
  promotion: { rules?: { attribute: string }[] | null }
}

async function makePromotion(page: Page): Promise<string> {
  const answer = await page.request.post("/admin/promotions", {
    data: {
      code: `ILK${String(Date.now()).slice(-6)}`,
      type: "standard",
      is_automatic: false,
      is_tax_inclusive: true,
      status: "draft",
      application_method: {
        type: "percentage",
        target_type: "order",
        allocation: "across",
        value: 10,
      },
    },
  })
  expect(answer.ok()).toBe(true)
  return ((await answer.json()) as { promotion: { id: string } }).promotion.id
}

async function ruleAttributes(page: Page, id: string): Promise<string[]> {
  const answer = await page.request.get(`/admin/promotions/${id}?fields=rules.attribute`)
  expect(answer.ok()).toBe(true)
  return ((await answer.json()) as PromotionRead).promotion.rules?.map((r) => r.attribute) ?? []
}

test.describe("who may use a promotion", () => {
  test("sets first order only in the conditions card and takes it off again", async ({
    page,
    guard,
  }) => {
    const id = await makePromotion(page)
    try {
      await page.goto(`/promotions/${id}`)
      await expect(pageHeading(page)).toBeVisible()
      const firstOrder = page.getByRole("switch", { name: /İlk siparişe özel/ })
      await expect(firstOrder).not.toBeChecked()
      await firstOrder.click()
      await expect(page.getByText("Yalnızca ilk siparişte", { exact: true })).toBeVisible()
      await page.getByRole("button", { name: "Kaydet", exact: true }).click()
      await expect.poll(() => ruleAttributes(page, id)).toContain("first_order")

      await page.reload()
      await expect(page.getByRole("switch", { name: /İlk siparişe özel/ })).toBeChecked()
      await page.getByRole("switch", { name: /İlk siparişe özel/ }).click()
      await page.getByRole("button", { name: "Kaydet", exact: true }).click()
      await expect.poll(() => ruleAttributes(page, id)).not.toContain("first_order")
      await guard.assertHealthy()
    } finally {
      await page.request.delete(`/admin/promotions/${id}`)
    }
  })
})
