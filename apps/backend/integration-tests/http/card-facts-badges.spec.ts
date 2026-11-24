import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { stockShop, stockedProduct } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"

jest.setTimeout(180 * 1000)

interface Facts {
  facts: Record<string, { badge?: { kind: string; text?: string } }>
}

/**
 * Product badges (the owner, 2026-11-24): a product's own line, cut and
 * checked on save, and "Yeni" on a product made within the shop's days,
 * each only while the shop has it on; one badge a card, its own first.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient

    it("answers the shop's badges only while they are on, the product's own first", async () => {
      const container = getContainer()
      const shop = await stockShop(container)
      const store = await createStorefront(container)
      const owner = await createAdminUser(http, container)
      const stamp = String(Date.now())
      const own = await stockedProduct(container, shop, `rozet-${stamp}`, 5)
      const plain = await stockedProduct(container, shop, `yeni-${stamp}`, 5)
      const facts = () =>
        settle(
          http.get<Facts>(`/store/card-facts?id=${own.productId}&id=${plain.productId}`, {
            headers: store.headers,
          })
        )
      const badges = (values: Record<string, unknown>) =>
        settle(
          http.post("/admin/platform-settings/product_badges", values, { headers: owner.headers })
        )
      const saveBadge = (badge: string | null) =>
        settle(
          http.post(
            `/admin/products/${own.productId}/catalog`,
            { badge },
            { headers: owner.headers }
          )
        )

      const tooLong = await saveBadge("x".repeat(25))
      const saved = await saveBadge("  Erken   rezervasyon ")
      const off = await facts()
      await badges({ manual_enabled: true, new_enabled: true, new_days: 30 })
      const on = await facts()
      await badges({ manual_enabled: false })
      const newOnly = await facts()
      // Settings outlive the database reset between tests (their cache)
      await badges({ manual_enabled: false, new_enabled: false })

      expect(tooLong.status).toBe(400)
      expect(saved.status).toBe(200)
      expect((saved.data as { badge: string | null }).badge).toBe("Erken rezervasyon")
      // All off at first: not a field more
      expect(off.data.facts[own.productId]).not.toHaveProperty("badge")
      expect(off.data.facts[plain.productId]).not.toHaveProperty("badge")
      expect(on.data.facts[own.productId]?.badge).toEqual({
        kind: "manual",
        text: "Erken rezervasyon",
      })
      expect(on.data.facts[plain.productId]?.badge).toEqual({ kind: "new" })
      expect(newOnly.data.facts[own.productId]?.badge).toEqual({ kind: "new" })
    })
  },
})
