import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminUser } from "../helpers/admin"
import { registerCustomer } from "../helpers/customer"
import type { TestCustomer } from "../helpers/customer"
import type { HttpClient } from "../helpers/http"
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

const NOT_WHOLESALE = { active: false, vat_exclusive: false, min_quantity: null }

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
      await staff.flag(true)
    })

    const shopper = (headers: Record<string, string>) =>
      settle(http.get<ShopperAnswer>("/store/customers/me/wholesale", { headers }))

    const prices = (headers: Record<string, string>, ids: string[]) =>
      settle(
        http.get<PricesAnswer>(
          `/store/customers/me/wholesale-prices?${ids.map((id) => `variant_id=${id}`).join("&")}`,
          { headers }
        )
      )

    /** A product at 100.00, a level pricing it 66.67 net, and a wholesaler of that level. */
    async function levelWholesaler(handle: string) {
      const product = await stockedProduct(getContainer(), shop, handle, null, 100)
      const tier = await staff.tier({ name: `Toptan ${handle}`, min_quantity: 12 })
      await staff.prices(tier.id, { set: [{ variant_id: product.variantId, net: "66.67" }] })
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
      expect([asked.status, asked.data]).toEqual([200, { wholesale: NOT_WHOLESALE }])
      const priced = await prices(headers, [variantId])
      expect([priced.status, priced.data]).toEqual([200, { wholesale_prices: {} }])
      expect(JSON.stringify(priced.data)).not.toMatch(/66\.67|80\.00/)
    }

    it("answers an active wholesaler with their level's price, net and gross, never stored", async () => {
      const { variantId, customer } = await levelWholesaler("seviye")
      const asked = await shopper(customer.headers)
      expect(asked.status).toBe(200)
      expect(asked.data).toEqual({
        wholesale: { active: true, vat_exclusive: true, min_quantity: 12 },
      })
      expect(asked.headers["cache-control"]).toBe("private, no-store")
      // Never the level's name, nor a group
      expect(JSON.stringify(asked.data)).not.toMatch(/Toptan|cusgroup_|wtier_/)

      const priced = await prices(customer.headers, [variantId])
      expect(priced.status).toBe(200)
      expect(priced.headers["cache-control"]).toBe("private, no-store")
      expect(priced.data).toEqual({
        wholesale_prices: { [variantId]: { net: "66.67", gross: "80.00", vat_rate: 20 } },
      })
    })

    it("gives a wholesaler's own price before the level's, and no one else's", async () => {
      const first = await levelWholesaler("ozel")
      await accounts.update(first.account.id, { own_prices: true })
      await accounts.prices(first.account.id, {
        set: [{ variant_id: first.variantId, net: "50.00" }],
      })
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
        expect(JSON.stringify(asked.data)).not.toMatch(/66\.67|80\.00|net|gross/)
      }
    })

    it("answers another customer, a closed wholesaler and a shop with the flag off alike", async () => {
      const { variantId, customer, account } = await levelWholesaler("kapali")
      const stranger: TestCustomer = await registerCustomer(http, store)
      await seesRetailOnly(stranger.headers, variantId)

      await staff.flag(false)
      await seesRetailOnly(customer.headers, variantId)
      await staff.flag(true)

      expect((await accounts.action(account.id, "deactivate")).status).toBe(200)
      await seesRetailOnly(customer.headers, variantId)
      expect((await accounts.action(account.id, "reactivate")).status).toBe(200)
      expect((await prices(customer.headers, [variantId])).data.wholesale_prices).toHaveProperty(
        variantId
      )
    })

    it("takes a page of variants at most, by their ids only", async () => {
      const { customer, variantId } = await levelWholesaler("sinir")
      const many = Array.from({ length: 101 }, (_, i) => `variant_${String(i)}`)
      expect((await prices(customer.headers, many)).status).toBe(400)
      const named = await settle(
        http.get(
          `/store/customers/me/wholesale-prices?variant_id=${variantId}&customer_id=${customer.id}`,
          { headers: customer.headers }
        )
      )
      expect(named.status).toBe(400)
      // An unknown variant is answered as having no price
      const unknown = await prices(customer.headers, ["variant_01UNKNOWN"])
      expect(unknown.data).toEqual({ wholesale_prices: {} })
    })

    it("leaves the public display retail, with the wholesaler's own key too", async () => {
      const { variantId, customer } = await levelWholesaler("herkese")
      for (const headers of [store.headers, customer.headers]) {
        const shown = await http.get<{ price_display: Record<string, { current: string }> }>(
          `/store/price-display?variant_id=${variantId}&currency_code=try`,
          { headers }
        )
        expect(shown.data.price_display[variantId]?.current).toBe("100.00")
      }
    })

    it("prices a guest's cart again at wholesale once the wholesaler takes it", async () => {
      const { variantId, customer } = await levelWholesaler("sepet")
      const made = await http.post<{ cart: { id: string } }>(
        "/store/carts",
        { region_id: shop.regionId, items: [{ variant_id: variantId, quantity: 1 }] },
        { headers: store.headers }
      )
      const cartId = made.data.cart.id
      const unit = async () =>
        (
          await http.get<{ cart: { items: { unit_price: number }[] } }>(
            `/store/carts/${cartId}?fields=items.unit_price`,
            { headers: customer.headers }
          )
        ).data.cart.items[0]?.unit_price
      expect(await unit()).toBe(100)
      await http.post(`/store/carts/${cartId}/customer`, {}, { headers: customer.headers })
      expect(await unit()).toBe(80)
    })
  },
})
