import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { LEGAL_MODULE } from "../../src/modules/legal"
import type LegalModuleService from "../../src/modules/legal/service"
import { CATALOG_ENTITY_TYPES } from "../../src/workflows/catalog/entity-paths"
import { seoPayloadFor } from "../../src/workflows/seo/payload"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { readyCart } from "../helpers/paytr"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(120 * 1000)

const COD = "pp_cod_cod"

interface AgeCheck {
  age_check: { required: boolean; min_age: number; declared: boolean }
}

/** F13.3, F13.4 (adr/0041 §4; KK2): a restricted cart is not paid for until its buyer declares their age. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let shop: StockShop
    let storefront: Storefront
    let admin: { headers: Record<string, string> }

    const asAdmin = <T>(url: string, body: unknown) =>
      settle(http.post<T & { message?: string }>(url, body, { headers: admin.headers }))
    const flag = (key: string, enabled: boolean) => asAdmin(`/admin/features/${key}`, { enabled })
    const check = async (cartId: string) =>
      (
        await http.get<AgeCheck>(`/store/carts/${cartId}/age-declaration`, {
          headers: storefront.headers,
        })
      ).data.age_check
    const declare = (cartId: string, birthDate: string) =>
      settle(
        http.post<{ message?: string }>(
          `/store/carts/${cartId}/age-declaration`,
          { birth_date: birthDate, confirmed: true },
          { headers: storefront.headers }
        )
      )
    const start = (cartId: string) =>
      settle(
        http.post<{ message?: string }>(
          `/store/carts/${cartId}/payment-session`,
          { provider_id: COD },
          { headers: storefront.headers }
        )
      )

    beforeEach(async () => {
      const container = getContainer()
      await loadTrAddressFixture(container)
      shop = await stockShop(container)
      storefront = await createStorefront(container)
      admin = await createAdminUser(http, container)
      await asAdmin("/admin/platform-settings/cash_on_delivery", {
        fee_type: "none",
        fee_value: 0,
        max_amount: 100_000,
        shipping_option_ids: [shop.shippingOptionId],
      })
      await flag("payments.cash_on_delivery", true)
    })

    it("asks the age for a product under a marked category, keeps no date of birth, and asks again for a higher limit", async () => {
      const container = getContainer()
      const { productId, variantId } = await stockedProduct(
        container,
        shop,
        `bicak-${String(Date.now())}`,
        10,
        150
      )
      const parent = await asAdmin<{ product_category: { id: string } }>(
        "/admin/product-categories",
        { name: "Mutfak", is_active: true }
      )
      const parentId = parent.data.product_category.id
      const child = await asAdmin<{ product_category: { id: string } }>(
        "/admin/product-categories",
        { name: "Bıçaklar", is_active: true, parent_category_id: parentId }
      )
      await asAdmin(`/admin/products/${productId}`, {
        categories: [{ id: child.data.product_category.id }],
      })

      // Marking needs the flag; then the parent's mark reaches the child's product
      const flagOff = await asAdmin(`/admin/category-restrictions/${parentId}`, {
        restriction: "weapon",
      })
      await flag("catalog.restricted", true)
      // A page's structured data needs the shop's own address
      await asAdmin("/admin/platform-settings/seo", { canonical_host: "magaza.example.com" })
      const marked = await asAdmin(`/admin/category-restrictions/${parentId}`, {
        restriction: "weapon",
      })
      const seo = await seoPayloadFor(
        container,
        { entity_type: CATALOG_ENTITY_TYPES.product, entity_id: productId },
        "/urun/bicak"
      )

      const cartId = await readyCart(container, shop, variantId)
      const notChecking = await check(cartId)
      await flag("compliance.age_verification", true)
      const asked = await check(cartId)
      const undeclared = await start(cartId)
      const young = await declare(cartId, "2015-01-01")
      const impossible = await declare(cartId, "2000-02-30")
      const declared = await declare(cartId, "1990-05-01")
      const afterDeclaring = await check(cartId)
      // The shop raises its limit: the buyer is asked again
      await asAdmin("/admin/platform-settings/compliance", { min_age: 21 })
      const raised = await check(cartId)
      const stale = await start(cartId)
      await declare(cartId, "1990-05-01")
      const started = await start(cartId)
      const completed = await settle(
        http.post<{ order?: { id: string } }>(
          `/store/carts/${cartId}/complete`,
          {},
          { headers: storefront.headers }
        )
      )
      const record = await http.get<{ age_declaration: { min_age: number } | null }>(
        `/admin/orders/${completed.data.order?.id ?? ""}/legal`,
        { headers: admin.headers }
      )
      const rows = await container
        .resolve<LegalModuleService>(LEGAL_MODULE)
        .listAgeDeclarations({ cart_id: cartId })

      expect(flagOff.status).toBe(400)
      expect(flagOff.data.message).toBe("catalog.restriction_disabled")
      expect(marked.status).toBe(200)
      expect(JSON.stringify(seo?.jsonLd)).toContain("https://schema.org/WeaponConsideration")
      expect(notChecking).toMatchObject({ required: false })
      expect(asked).toEqual({ required: true, min_age: 18, declared: false })
      expect(undeclared.data.message).toBe("age.declaration_missing")
      expect(young.data.message).toBe("age.under_limit")
      expect(impossible.data.message).toBe("age.birth_date_invalid")
      expect(declared.status).toBe(200)
      expect(afterDeclaring.declared).toBe(true)
      expect(raised).toMatchObject({ min_age: 21, declared: false })
      expect(stale.data.message).toBe("age.declaration_missing")
      expect(started.status).toBe(200)
      expect(completed.status).toBe(200)
      expect(record.data.age_declaration).toMatchObject({ min_age: 21 })
      // Only the limit and the time are kept, never the date of birth
      expect(JSON.stringify(rows)).not.toContain("1990")
    })
  },
})
