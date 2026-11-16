import { Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { wholesaleListsState } from "../../src/workflows/wholesale/lists-status"
import { createAdminUser } from "../helpers/admin"
import { registerCustomer } from "../helpers/customer"
import type { HttpClient } from "../helpers/http"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"
import { loadTrAddressFixture } from "../helpers/tr-address"
import { accountApi, tierRecords, wholesaleApi } from "../helpers/wholesale"
import {
  bankTransferOn,
  cartPrices,
  completeCart,
  leaveGroup,
  readyShopperCart,
  startPayment,
} from "../helpers/wholesale-checkout"
import { outcome } from "../helpers/wholesale-store"

jest.setTimeout(240 * 1000)

/**
 * ADR-0068 slice 4 (§7, §8; review M1): a cart is paid only at its
 * customer's prices now, and a wholesaler's only at its minimum. Retail
 * 100.00 TL (KDV 20% in); the level 66.67 without KDV, 80.00 with it.
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
      await bankTransferOn(http, admin.headers)
      expect((await staff.flag(true)).status).toBe(200)
    })

    /** A product at 100.00, a level pricing it 66.67 net (80.00), a wholesaler of the level. */
    async function levelWholesaler(handle: string, tierFields: Record<string, unknown> = {}) {
      const product = await stockedProduct(getContainer(), shop, handle, 50, 100)
      const tier = await staff.tier({ name: `Toptan ${handle}`, ...tierFields })
      const set = await staff.prices(tier.id, {
        set: [{ variant_id: product.variantId, net: "66.67" }],
      })
      expect(outcome(set, 200)).toEqual({ status: 200, data: null })
      const customer = await registerCustomer(http, store)
      await accounts.made({ email: customer.email, contact_name: "Ali Kaya", tier_id: tier.id })
      const { groupId } = await tierRecords(getContainer(), tier.id)
      return { ...product, customer, tier, groupId }
    }

    it("prices a stale wholesale cart at retail before taking its payment (review M1)", async () => {
      const { variantId, customer, groupId } = await levelWholesaler("bayat")
      const cartId = await readyShopperCart(http, getContainer(), shop, customer.headers, variantId)
      expect((await cartPrices(getContainer(), cartId)).units).toEqual([80])
      // Out of the level the way a reprice that failed leaves them: the cart still at 80
      await leaveGroup(getContainer(), groupId, customer.id)

      const refused = await startPayment(http, customer.headers, cartId)
      expect({ status: refused.status, message: refused.data.message }).toEqual({
        status: 409,
        message: "wholesale.prices_changed",
      })
      expect((await cartPrices(getContainer(), cartId)).units).toEqual([100])

      const started = await startPayment(http, customer.headers, cartId)
      expect(outcome(started, 200)).toEqual({ status: 200, data: null })
      const order = await completeCart(http, customer.headers, cartId)
      expect({ status: order.status, type: order.data.type }).toEqual({
        status: 200,
        type: "order",
      })
    })

    it("refuses the order when the prices changed after the payment started", async () => {
      const { variantId, customer, groupId } = await levelWholesaler("sonra")
      const cartId = await readyShopperCart(http, getContainer(), shop, customer.headers, variantId)
      expect(outcome(await startPayment(http, customer.headers, cartId), 200)).toEqual({
        status: 200,
        data: null,
      })
      await leaveGroup(getContainer(), groupId, customer.id)

      const refused = await completeCart(http, customer.headers, cartId)
      expect({ status: refused.status, message: refused.data.message }).toEqual({
        status: 409,
        message: "wholesale.prices_changed",
      })
      // No order, the cart still open: the next start prices it, then it is paid at retail
      expect((await startPayment(http, customer.headers, cartId)).status).toBe(409)
      expect((await startPayment(http, customer.headers, cartId)).status).toBe(200)
      const order = await completeCart(http, customer.headers, cartId)
      expect(order.data.type).toBe("order")
      expect((await cartPrices(getContainer(), cartId)).units).toEqual([100])
    })

    it("refuses a wholesale order under its minimum, telling both numbers (§8)", async () => {
      const { variantId, customer } = await levelWholesaler("asgari", { min_quantity: 3 })
      const short = await readyShopperCart(
        http,
        getContainer(),
        shop,
        customer.headers,
        variantId,
        2
      )
      const refused = await startPayment(http, customer.headers, short)
      expect({ status: refused.status, ...refused.data }).toMatchObject({
        status: 400,
        message: "wholesale.min_quantity",
        values: { min: "3", units: "2" },
      })

      const enough = await readyShopperCart(
        http,
        getContainer(),
        shop,
        customer.headers,
        variantId,
        3
      )
      expect(outcome(await startPayment(http, customer.headers, enough), 200)).toEqual({
        status: 200,
        data: null,
      })
      // A retail shopper has no minimum
      const shopper = await registerCustomer(http, store)
      const retail = await readyShopperCart(
        http,
        getContainer(),
        shop,
        shopper.headers,
        variantId,
        1
      )
      expect((await startPayment(http, shopper.headers, retail)).status).toBe(200)
    })

    it("reads the lists' state from the database, a flag turn changing it (#93 review D4)", async () => {
      const { tier } = await levelWholesaler("durum")
      const { priceListId } = await tierRecords(getContainer(), tier.id)
      const before = await wholesaleListsState(getContainer())
      expect(before).toMatch(/^plist_[^:]+:active:\d+$/)

      expect((await staff.flag(false)).status).toBe(200)
      const after = await wholesaleListsState(getContainer())
      expect(after).toMatch(/^plist_[^:]+:draft:\d+$/)
      expect(after).not.toBe(before)
      const [list] = await getContainer()
        .resolve(Modules.PRICING)
        .listPriceLists({ id: [priceListId] }, { take: 1 })
      expect({ status: list?.status, named: after?.startsWith(`${priceListId}:`) }).toEqual({
        status: "draft",
        named: true,
      })
    })
  },
})
