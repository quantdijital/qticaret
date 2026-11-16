import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminUser } from "../helpers/admin"
import { registerCustomer } from "../helpers/customer"
import type { HttpClient } from "../helpers/http"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"
import { loadTrAddressFixture } from "../helpers/tr-address"
import { accountApi, groupsOf, tierRecords, wholesaleApi } from "../helpers/wholesale"
import { cartPrices, readyShopperCart } from "../helpers/wholesale-checkout"
import { outcome, plain } from "../helpers/wholesale-store"

jest.setTimeout(240 * 1000)

/**
 * ADR-0068 §6 (slice 4): no automatic campaign and no code on an active
 * wholesaler's cart, both as Medusa 2.21.2 computes promotions; and a
 * deletion refused for a cart it cannot price is undone (Ek 2026-11-16).
 * Retail 100.00 TL; the level 80.00 with KDV.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: Awaited<ReturnType<typeof createAdminUser>>
    let staff: ReturnType<typeof wholesaleApi>
    let accounts: ReturnType<typeof accountApi>
    let shop: StockShop
    let store: Storefront

    beforeEach(async () => {
      await loadTrAddressFixture(getContainer())
      admin = await createAdminUser(http, getContainer())
      staff = wholesaleApi(http, admin.headers)
      accounts = accountApi(http, admin.headers)
      shop = await stockShop(getContainer())
      store = await createStorefront(getContainer())
      expect((await staff.flag(true)).status).toBe(200)
    })

    async function levelWholesaler(handle: string) {
      const product = await stockedProduct(getContainer(), shop, handle, 50, 100)
      const tier = await staff.tier({ name: `Toptan ${handle}` })
      const set = await staff.prices(tier.id, {
        set: [{ variant_id: product.variantId, net: "66.67" }],
      })
      expect(outcome(set, 200)).toEqual({ status: 200, data: null })
      const customer = await registerCustomer(http, store)
      const account = await accounts.made({
        email: customer.email,
        contact_name: "Ali Kaya",
        tier_id: tier.id,
      })
      return { ...product, customer, account, tier }
    }

    /** A 10% promotion on the whole order, as the panel makes one. */
    async function orderPercent(code: string, automatic: boolean) {
      const made = await plain(
        http.post(
          "/admin/promotions",
          {
            code,
            type: "standard",
            is_automatic: automatic,
            is_tax_inclusive: true,
            status: "active",
            application_method: {
              type: "percentage",
              target_type: "order",
              allocation: "across",
              value: 10,
            },
          },
          { headers: admin.headers }
        )
      )
      expect(outcome(made, 200)).toEqual({ status: 200, data: null })
    }

    const addCode = (cartId: string, headers: Record<string, string>, code: string) =>
      plain(
        http.post<{ message?: string }>(
          `/store/carts/${cartId}/promotions`,
          { promo_codes: [code] },
          { headers }
        )
      )

    const ready = (headers: Record<string, string>, variantId: string) =>
      readyShopperCart(http, getContainer(), shop, headers, variantId)

    it("gives a guest the shop's automatic campaign and a wholesaler none", async () => {
      const { variantId, customer } = await levelWholesaler("kampanya")
      await orderPercent("KIS10", true)

      const guest = await ready(store.headers, variantId)
      expect(await cartPrices(getContainer(), guest)).toMatchObject({
        units: [100],
        discount: 10,
        codes: ["KIS10"],
      })
      const wholesale = await ready(customer.headers, variantId)
      expect(await cartPrices(getContainer(), wholesale)).toEqual({
        units: [80],
        discount: 0,
        codes: [],
      })
    })

    it("takes the campaign off a guest's cart the wholesaler takes on signing in", async () => {
      const { variantId, customer } = await levelWholesaler("devral")
      await orderPercent("KIS10", true)
      const cartId = await ready(store.headers, variantId)
      expect((await cartPrices(getContainer(), cartId)).discount).toBe(10)

      const taken = await plain(
        http.post(`/store/carts/${cartId}/customer`, {}, { headers: customer.headers })
      )
      expect(outcome(taken, 200)).toEqual({ status: 200, data: null })
      expect(await cartPrices(getContainer(), cartId)).toEqual({
        units: [80],
        discount: 0,
        codes: [],
      })
    })

    it("refuses a code on a wholesaler's cart, made with one or added, and takes one for retail", async () => {
      const { variantId, customer } = await levelWholesaler("kod")
      await orderPercent("YAZ10", false)

      const cartId = await ready(customer.headers, variantId)
      const added = await addCode(cartId, customer.headers, "yaz10")
      expect({ status: added.status, message: added.data.message }).toEqual({
        status: 400,
        message: "promotions.wholesale_no_code",
      })
      const made = await plain(
        http.post<{ message?: string }>(
          "/store/carts",
          { region_id: shop.regionId, promo_codes: ["YAZ10"] },
          { headers: customer.headers }
        )
      )
      expect({ status: made.status, message: made.data.message }).toEqual({
        status: 400,
        message: "promotions.wholesale_no_code",
      })
      expect((await cartPrices(getContainer(), cartId)).codes).toEqual([])

      const shopper = await registerCustomer(http, store)
      const retail = await ready(shopper.headers, variantId)
      expect((await addCode(retail, shopper.headers, "YAZ10")).status).toBe(200)
      expect(await cartPrices(getContainer(), retail)).toMatchObject({
        discount: 10,
        codes: ["YAZ10"],
      })
    })

    it("undoes a deletion refused for a cart it cannot price (wholesale.carts_not_repriced)", async () => {
      const { productId, variantId, customer, account, tier } = await levelWholesaler("silinmez")
      const cartId = await ready(customer.headers, variantId)
      const { groupId } = await tierRecords(getContainer(), tier.id)
      // A product taken off sale: Medusa's refresh refuses the cart's line
      await updateProductsWorkflow(getContainer()).run({
        input: { selector: { id: productId }, update: { status: "draft" } },
      })

      const refused = await accounts.remove(account.id)
      expect({ status: refused.status, data: refused.data }).toMatchObject({
        status: 409,
        data: { message: "wholesale.carts_not_repriced" },
      })
      // As it was: active, in its level, the cart still at wholesale
      expect((await accounts.get(account.id)).data.account.status).toBe("active")
      expect(await groupsOf(getContainer(), customer.id)).toEqual([groupId])
      expect((await cartPrices(getContainer(), cartId)).units).toEqual([80])

      await updateProductsWorkflow(getContainer()).run({
        input: { selector: { id: productId }, update: { status: "published" } },
      })
      expect((await accounts.remove(account.id)).status).toBe(200)
      expect((await cartPrices(getContainer(), cartId)).units).toEqual([100])
    })
  },
})
