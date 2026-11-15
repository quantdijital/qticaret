import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { placeOrder } from "../../src/scripts/seed/orders/place"
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
import { outcome, plain } from "../helpers/wholesale-store"

jest.setTimeout(240 * 1000)

interface CartAnswer {
  cart: {
    id: string
    item_subtotal?: number
    item_tax_total?: number
    items?: { unit_price: number }[]
  }
}

interface CartState {
  updated_at: unknown
  items: { unit_price: unknown; updated_at: unknown }[]
}

/**
 * ADR-0068 slice 3 (§7) and its security review: a guest's cart a
 * wholesaler takes is priced at wholesale at once; a cart that is not
 * theirs and open, or a payment link's, is never priced again by it (M1);
 * one unit's price without KDV is what a one-unit cart says (L4). Retail
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

    /** A product at 100.00 on the shelf, a level pricing it 66.67 net, and a wholesaler of it. */
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
      expect(account.status).toBe("active")
      return { ...product, customer }
    }

    /** A cart with one unit, made and filled as a shopper does with these headers. */
    async function cartWith(headers: Record<string, string>, variantId: string) {
      const made = await plain(
        http.post<CartAnswer>("/store/carts", { region_id: shop.regionId }, { headers })
      )
      expect(outcome(made, 200)).toEqual({ status: 200, data: null })
      const cartId = made.data.cart.id
      const added = await plain(
        http.post(
          `/store/carts/${cartId}/line-items`,
          { variant_id: variantId, quantity: 1 },
          { headers }
        )
      )
      expect(outcome(added, 200)).toEqual({ status: 200, data: null })
      return cartId
    }

    /** The cart's lines and times as the database holds them: plain values only. */
    async function stateOf(cartId: string): Promise<CartState> {
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({
          entity: "cart",
          fields: ["updated_at", "items.unit_price", "items.updated_at"],
          filters: { id: cartId },
        })
      const cart = data[0] as unknown as CartState
      return JSON.parse(JSON.stringify(cart)) as CartState
    }

    const unitOf = (state: CartState) => Number(state.items[0]?.unit_price)

    const take = (cartId: string, headers: Record<string, string>) =>
      plain(http.post<CartAnswer>(`/store/carts/${cartId}/customer`, {}, { headers }))

    /** The one answer for a cart that may not move, an unknown id's too (review M1). */
    const refusedAsUnknown = (answer: { status: number; data: unknown }) => {
      expect({
        status: answer.status,
        cart: JSON.stringify(answer.data).includes('"cart"'),
      }).toEqual({ status: 404, cart: false })
    }

    it("answers an unknown cart id as any cart that may not move", async () => {
      const { customer } = await levelWholesaler("bilinmez")
      refusedAsUnknown(await take("cart_01UNKNOWN0000000000000000", customer.headers))
    })

    it("prices a guest's cart again at wholesale once the wholesaler takes it", async () => {
      const { variantId, customer } = await levelWholesaler("sepet")
      const cartId = await cartWith(store.headers, variantId)
      expect(unitOf(await stateOf(cartId))).toBe(100)

      const taken = await take(cartId, customer.headers)
      expect(outcome(taken, 200)).toEqual({ status: 200, data: null })
      // The transfer's own answer is the cart as priced now
      expect(taken.data.cart.items?.[0]?.unit_price).toBe(80)
      expect(unitOf(await stateOf(cartId))).toBe(80)
    })

    it("never prices another registered customer's cart (review M1)", async () => {
      const { variantId, customer } = await levelWholesaler("baskasi")
      const other = await registerCustomer(http, store)
      const cartId = await cartWith(other.headers, variantId)
      const before = await stateOf(cartId)
      expect(unitOf(before)).toBe(100)

      const taken = await take(cartId, customer.headers)
      // Answered as a cart that does not exist: nothing of it told, nothing of it changed
      refusedAsUnknown(taken)
      expect(await stateOf(cartId)).toEqual(before)
    })

    it("still lets a retail customer take their own guest cart, at retail", async () => {
      const { variantId } = await levelWholesaler("perakende")
      const shopper = await registerCustomer(http, store)
      const cartId = await cartWith(store.headers, variantId)
      const taken = await take(cartId, shopper.headers)
      expect(outcome(taken, 200)).toEqual({ status: 200, data: null })
      expect(unitOf(await stateOf(cartId))).toBe(100)
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({ entity: "cart", fields: ["customer_id"], filters: { id: cartId } })
      expect((data[0] as { customer_id: string | null }).customer_id).toBe(shopper.id)
    })

    it("never prices a completed cart (review M1)", async () => {
      const { variantId, customer } = await levelWholesaler("tamam")
      let cartId = ""
      await placeOrder(getContainer(), {
        ...shop,
        items: [{ variant_id: variantId, quantity: 1 }],
        address: { first_name: "Ayşe", last_name: "Yılmaz", address_1: "Demo Sokak 1" },
        beforeComplete: (id) => {
          cartId = id
          return Promise.resolve()
        },
      })
      const before = await stateOf(cartId)
      expect(unitOf(before)).toBe(100)

      refusedAsUnknown(await take(cartId, customer.headers))
      expect(await stateOf(cartId)).toEqual(before)
    })

    it("keeps a payment link's cart at the link's prices when a wholesaler takes it (review M1)", async () => {
      await loadTrAddressFixture(getContainer())
      const { variantId, customer } = await levelWholesaler("baglanti")
      await linkShop(http, getContainer(), admin.headers)
      const made = await makeLink(http, admin.headers, linkBody(shop, variantId))
      expect(outcome({ status: made.status, data: made.data }, 201)).toEqual({
        status: 201,
        data: null,
      })
      const opened = await plain(
        http.post<{ cart_id?: string }>(
          `/store/payment-links/${tokenOf(made.data.share?.url)}/cart`,
          {},
          { headers: store.headers }
        )
      )
      expect(outcome(opened, 200)).toEqual({ status: 200, data: null })
      const cartId = opened.data.cart_id ?? ""
      const before = await stateOf(cartId)
      expect(before.items.map((item) => Number(item.unit_price))).toEqual([100])

      // A link's cart never moves: its lines stay at the link's price
      refusedAsUnknown(await take(cartId, customer.headers))
      expect(await stateOf(cartId)).toEqual(before)
    })

    it("says without KDV for one unit what a one-unit cart says (review L4)", async () => {
      const { variantId, customer } = await levelWholesaler("birim")
      const priced = await plain(
        http.get<{ wholesale_prices: Record<string, { net: string }> }>(
          `/store/customers/me/wholesale-prices?variant_id=${variantId}`,
          { headers: customer.headers }
        )
      )
      const net = priced.data.wholesale_prices[variantId]?.net
      expect(net).toBe("66.67")

      const cartId = await cartWith(customer.headers, variantId)
      const read = await plain(
        http.get<CartAnswer>(`/store/carts/${cartId}?fields=id,item_subtotal,item_tax_total`, {
          headers: customer.headers,
        })
      )
      expect(read.status).toBe(200)
      const subtotal = Number(read.data.cart.item_subtotal)
      // Medusa keeps digits below a kuruş; the storefront shows the kuruş
      expect({ subtotal, kurus: Math.round(subtotal * 100) }).toEqual({
        subtotal,
        kurus: Math.round(Number(net) * 100),
      })
      expect(Math.round(Number(read.data.cart.item_tax_total) * 100)).toBe(1333)
    })
  },
})
