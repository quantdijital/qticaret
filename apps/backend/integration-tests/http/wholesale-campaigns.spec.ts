import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminUser } from "../helpers/admin"
import { registerCustomer } from "../helpers/customer"
import type { HttpClient } from "../helpers/http"
import { linkBody, linkFlag, linkShop, makeLink, tokenOf } from "../helpers/payment-links"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"
import { loadTrAddressFixture } from "../helpers/tr-address"
import { accountApi, wholesaleApi } from "../helpers/wholesale"
import {
  bankTransferOn,
  cartPrices,
  makePromotion,
  readyShopperCart,
  startPayment,
} from "../helpers/wholesale-checkout"
import { outcome, plain } from "../helpers/wholesale-store"

jest.setTimeout(240 * 1000)

/**
 * ADR-0068 §6, Ek 2026-11-16 (slice 4 review O2): the shells a wholesaler's
 * cart gives Medusa 2.21.2's promotion rules leave no adjustment and no
 * promotion link, whatever the campaign aims at (shipping, buy X pay Y);
 * a payment link's cart, whose code staff set, is left as the link made it.
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
    // The links' flag lives in settings, whose cache outlives the database reset between tests
    afterEach(async () => {
      await linkFlag(http, admin.headers, false)
    })

    async function levelWholesaler(handle: string) {
      const product = await stockedProduct(getContainer(), shop, handle, 50, 100)
      const tier = await staff.tier({ name: `Toptan ${handle}` })
      const set = await staff.prices(tier.id, {
        set: [{ variant_id: product.variantId, net: "66.67" }],
      })
      expect(outcome(set, 200)).toEqual({ status: 200, data: null })
      const customer = await registerCustomer(http, store)
      await accounts.made({ email: customer.email, contact_name: "Ali Kaya", tier_id: tier.id })
      return { ...product, customer }
    }

    /** The adjustments on the cart's lines and shipping, counted. */
    async function adjustmentsOf(cartId: string) {
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({
          entity: "cart",
          fields: ["items.adjustments.id", "shipping_methods.adjustments.id"],
          filters: { id: cartId },
        })
      const cart = data[0] as {
        items?: { adjustments?: unknown[] | null }[]
        shipping_methods?: { adjustments?: unknown[] | null }[]
      }
      const count = (rows?: { adjustments?: unknown[] | null }[]) =>
        (rows ?? []).reduce((sum, row) => sum + (row.adjustments ?? []).length, 0)
      return { items: count(cart.items), shipping: count(cart.shipping_methods) }
    }

    it("gives a guest free shipping by campaign, and a wholesaler no shipping adjustment or link", async () => {
      const { variantId, customer } = await levelWholesaler("kargo")
      await makePromotion(http, admin.headers, {
        code: "KARGOBEDAVA",
        is_automatic: true,
        application_method: {
          type: "percentage",
          target_type: "shipping_methods",
          allocation: "each",
          value: 100,
        },
      })
      const guest = await readyShopperCart(http, getContainer(), shop, store.headers, variantId)
      expect(await adjustmentsOf(guest)).toEqual({ items: 0, shipping: 1 })
      expect((await cartPrices(getContainer(), guest)).codes).toEqual(["KARGOBEDAVA"])

      const wholesale = await readyShopperCart(
        http,
        getContainer(),
        shop,
        customer.headers,
        variantId
      )
      expect(await adjustmentsOf(wholesale)).toEqual({ items: 0, shipping: 0 })
      expect(await cartPrices(getContainer(), wholesale)).toEqual({
        units: [80],
        discount: 0,
        codes: [],
      })
    })

    it("gives a guest buy 3 pay 2 by campaign, and a wholesaler none", async () => {
      const { productId, variantId, customer } = await levelWholesaler("ucal")
      const rules = [{ attribute: "items.product.id", operator: "in", values: [productId] }]
      await makePromotion(http, admin.headers, {
        code: "UCAL",
        type: "buyget",
        is_automatic: true,
        application_method: {
          type: "percentage",
          target_type: "items",
          allocation: "each",
          value: 100,
          max_quantity: 1000,
          apply_to_quantity: 1,
          buy_rules_min_quantity: 2,
          buy_rules: rules,
          target_rules: rules,
        },
      })
      const ready = (headers: Record<string, string>) =>
        readyShopperCart(http, getContainer(), shop, headers, variantId, 3)
      expect(await cartPrices(getContainer(), await ready(store.headers))).toMatchObject({
        discount: 100,
        codes: ["UCAL"],
      })
      const wholesale = await ready(customer.headers)
      expect(await adjustmentsOf(wholesale)).toEqual({ items: 0, shipping: 0 })
      expect(await cartPrices(getContainer(), wholesale)).toEqual({
        units: [80],
        discount: 0,
        codes: [],
      })
    })

    it("leaves a wholesaler's payment link cart as the link made it, its code kept", async () => {
      const { variantId, customer } = await levelWholesaler("baglanti")
      await bankTransferOn(http, admin.headers)
      await linkShop(http, getContainer(), admin.headers)
      const forCustomer = linkBody(shop, variantId, {
        discount: { type: "percentage", value: 10, reason: "Toptan müşteri" },
      })
      const made = await makeLink(http, admin.headers, {
        ...forCustomer,
        guest: undefined,
        customer_id: customer.id,
      })
      expect({ status: made.status, message: made.data.message }).toMatchObject({ status: 201 })
      const opened = await plain(
        http.post<{ cart_id?: string }>(
          `/store/payment-links/${tokenOf(made.data.share?.url)}/cart`,
          {},
          { headers: store.headers }
        )
      )
      expect(outcome(opened, 200)).toEqual({ status: 200, data: null })
      const cartId = opened.data.cart_id ?? ""
      // Two units at the link's (the wholesaler's) price, the link's own code taking 10% off
      const priced = await cartPrices(getContainer(), cartId)
      expect({
        units: priced.units,
        discount: priced.discount,
        coded: priced.codes.length,
      }).toEqual({ units: [80], discount: 16, coded: 1 })

      // Neither the wholesale rules nor the link's own refuse it
      expect(outcome(await startPayment(http, store.headers, cartId), 200)).toEqual({
        status: 200,
        data: null,
      })
    })
  },
})
