import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminUser } from "../helpers/admin"
import { registerCustomer } from "../helpers/customer"
import type { HttpClient, HttpResponse } from "../helpers/http"
import { settle } from "../helpers/http"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"
import { accountApi, wholesaleApi } from "../helpers/wholesale"

jest.setTimeout(240 * 1000)

interface ShopperAnswer {
  wholesale: { active: boolean; vat_exclusive: boolean; min_quantity: number | null }
}

interface PricesAnswer {
  wholesale_prices: Record<string, { net: string; gross: string; vat_rate: number }>
}

interface CartAnswer {
  cart: { id: string; items?: { unit_price: number }[] }
}

/** An answer as an assertion sees it: never axios' own objects (they hold each other). */
interface Plain<T> {
  status: number
  data: T
  cacheControl: string | null
}

async function plain<T>(request: Promise<HttpResponse<T>>): Promise<Plain<T>> {
  try {
    const { status, data, headers } = await settle(request)
    const cacheControl = headers["cache-control"]
    return { status, data, cacheControl: typeof cacheControl === "string" ? cacheControl : null }
  } catch (error) {
    const { message, code } = error as { message?: unknown; code?: unknown }
    // The cause would carry axios' circular objects to Jest's worker: its text is enough
    // eslint-disable-next-line preserve-caught-error
    throw new Error(`request failed without an answer: ${String(code)} ${String(message)}`)
  }
}

const NOT_WHOLESALE = { active: false, vat_exclusive: false, min_quantity: null }

/** Status and, only when it is not the one expected, the body: what a failure needs to say. */
const outcome = (answer: { status: number; data: unknown }, expected: number) => ({
  status: answer.status,
  data: answer.status === expected ? null : answer.data,
})

/**
 * ADR-0068 slice 3 (§7): the signed-in wholesaler's own answers. Retail
 * 100.00 TL (KDV 20% in); the level's price 66.67 without KDV, 80.00
 * with it; a wholesaler's own 50.00 without (60.00 with). Guests,
 * other customers, a closed account and a shop with the flag off never
 * see a wholesale amount; the answers are private and never stored.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let staff: ReturnType<typeof wholesaleApi>
    let accounts: ReturnType<typeof accountApi>
    let shop: StockShop
    let store: Storefront

    beforeEach(async () => {
      const admin = await createAdminUser(http, getContainer())
      staff = wholesaleApi(http, admin.headers)
      accounts = accountApi(http, admin.headers)
      shop = await stockShop(getContainer())
      store = await createStorefront(getContainer())
      expect((await staff.flag(true)).status).toBe(200)
    })

    const shopper = (headers: Record<string, string>) =>
      plain(http.get<ShopperAnswer>("/store/customers/me/wholesale", { headers }))

    const prices = (headers: Record<string, string>, ids: string[]) =>
      plain(
        http.get<PricesAnswer>(
          `/store/customers/me/wholesale-prices?${ids.map((id) => `variant_id=${encodeURIComponent(id)}`).join("&")}`,
          { headers }
        )
      )

    /** A product at 100.00 on the shelf, a level pricing it 66.67 net, and a wholesaler of it. */
    async function levelWholesaler(handle: string) {
      // On the shelf: a cart takes a tracked variant only with stock at the channel's warehouse
      const product = await stockedProduct(getContainer(), shop, handle, 50, 100)
      const tier = await staff.tier({ name: `Toptan ${handle}`, min_quantity: 12 })
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
      return { ...product, tier, customer, account }
    }

    /** Neither answer carries anything but the non-wholesaler's. */
    async function seesRetailOnly(headers: Record<string, string>, variantId: string) {
      const asked = await shopper(headers)
      expect({ status: asked.status, data: asked.data }).toEqual({
        status: 200,
        data: { wholesale: NOT_WHOLESALE },
      })
      const priced = await prices(headers, [variantId])
      expect({ status: priced.status, data: priced.data }).toEqual({
        status: 200,
        data: { wholesale_prices: {} },
      })
    }

    it("answers an active wholesaler with their level's price, net and gross, never stored", async () => {
      const { variantId, customer } = await levelWholesaler("seviye")
      const asked = await shopper(customer.headers)
      expect({ status: asked.status, data: asked.data }).toEqual({
        status: 200,
        data: { wholesale: { active: true, vat_exclusive: true, min_quantity: 12 } },
      })
      expect(asked.cacheControl).toBe("private, no-store")
      // Never the level's name, nor a group
      expect(JSON.stringify(asked.data)).not.toMatch(/Toptan|cusgroup_|wtier_/)

      const priced = await prices(customer.headers, [variantId])
      expect({ status: priced.status, data: priced.data }).toEqual({
        status: 200,
        data: { wholesale_prices: { [variantId]: { net: "66.67", gross: "80.00", vat_rate: 20 } } },
      })
      expect(priced.cacheControl).toBe("private, no-store")
    })

    it("gives a wholesaler's own price before the level's, and no one else's", async () => {
      const first = await levelWholesaler("ozel")
      const opened = await accounts.update(first.account.id, { own_prices: true })
      expect(outcome(opened, 200)).toEqual({ status: 200, data: null })
      const written = await accounts.prices(first.account.id, {
        set: [{ variant_id: first.variantId, net: "50.00" }],
      })
      expect(outcome(written, 200)).toEqual({ status: 200, data: null })
      const other = await registerCustomer(http, store)
      await accounts.made({ email: other.email, contact_name: "Veli", tier_id: first.tier.id })

      const own = await prices(first.customer.headers, [first.variantId])
      expect(own.data.wholesale_prices[first.variantId]).toEqual({
        net: "50.00",
        gross: "60.00",
        vat_rate: 20,
      })
      // The other wholesaler of the level pays the level's price, asking for the same variant
      const theirs = await prices(other.headers, [first.variantId])
      expect(theirs.data.wholesale_prices[first.variantId]?.net).toBe("66.67")
      expect(JSON.stringify(theirs.data)).not.toContain("50.00")
    })

    it("answers a guest 401, never with an amount", async () => {
      const { variantId } = await levelWholesaler("misafir")
      for (const asked of [
        await shopper(store.headers),
        await prices(store.headers, [variantId]),
      ]) {
        expect(asked.status).toBe(401)
        expect(JSON.stringify(asked.data)).not.toMatch(/66\.67|80\.00|"net"|"gross"/)
      }
    })

    it("answers another customer, a closed wholesaler and a shop with the flag off alike", async () => {
      const { variantId, customer, account } = await levelWholesaler("kapali")
      const stranger = await registerCustomer(http, store)
      await seesRetailOnly(stranger.headers, variantId)

      expect((await staff.flag(false)).status).toBe(200)
      await seesRetailOnly(customer.headers, variantId)
      expect((await staff.flag(true)).status).toBe(200)

      expect((await accounts.action(account.id, "deactivate")).status).toBe(200)
      await seesRetailOnly(customer.headers, variantId)
      expect((await accounts.action(account.id, "reactivate")).status).toBe(200)
      const back = await prices(customer.headers, [variantId])
      expect(back.data.wholesale_prices[variantId]?.net).toBe("66.67")
    })

    it("takes a page of variants at most, by their ids only", async () => {
      const { customer, variantId } = await levelWholesaler("sinir")
      const many = Array.from({ length: 101 }, (_, i) => `variant_${String(i)}`)
      expect((await prices(customer.headers, many)).status).toBe(400)
      const named = await plain(
        http.get(
          `/store/customers/me/wholesale-prices?variant_id=${variantId}&customer_id=${customer.id}`,
          { headers: customer.headers }
        )
      )
      expect(named.status).toBe(400)
      // An unknown variant is answered as having no price
      const unknown = await prices(customer.headers, ["variant_01UNKNOWN"])
      expect({ status: unknown.status, data: unknown.data }).toEqual({
        status: 200,
        data: { wholesale_prices: {} },
      })
    })

    it("leaves the public display retail, with the wholesaler's own key too", async () => {
      const { variantId, customer } = await levelWholesaler("herkese")
      for (const headers of [store.headers, customer.headers]) {
        const shown = await plain(
          http.get<{ price_display: Record<string, { current: string }> }>(
            `/store/price-display?variant_id=${variantId}&currency_code=try`,
            { headers }
          )
        )
        expect(shown.status).toBe(200)
        expect(shown.data.price_display[variantId]?.current).toBe("100.00")
      }
    })

    it("prices a guest's cart again at wholesale once the wholesaler takes it", async () => {
      const { variantId, customer } = await levelWholesaler("sepet")
      const made = await plain(
        http.post<CartAnswer>(
          "/store/carts",
          { region_id: shop.regionId },
          { headers: store.headers }
        )
      )
      expect(outcome(made, 200)).toEqual({ status: 200, data: null })
      const cartId = made.data.cart.id
      const added = await plain(
        http.post(
          `/store/carts/${cartId}/line-items`,
          { variant_id: variantId, quantity: 1 },
          { headers: store.headers }
        )
      )
      expect(outcome(added, 200)).toEqual({ status: 200, data: null })
      const unit = async () => {
        const read = await plain(
          http.get<CartAnswer>(`/store/carts/${cartId}`, { headers: store.headers })
        )
        expect(read.status).toBe(200)
        return read.data.cart.items?.[0]?.unit_price
      }
      expect(await unit()).toBe(100)

      const taken = await plain(
        http.post<CartAnswer>(`/store/carts/${cartId}/customer`, {}, { headers: customer.headers })
      )
      expect(outcome(taken, 200)).toEqual({ status: 200, data: null })
      // The transfer's own answer is the cart as priced now
      expect(taken.data.cart.items?.[0]?.unit_price).toBe(80)
      expect(await unit()).toBe(80)
    })
  },
})
