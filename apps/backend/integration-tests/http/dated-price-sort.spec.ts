import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { todayIn } from "../../src/lib/seo/facets-dated"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { indexCatalogue } from "../helpers/search-index"
import { stockShop } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"

jest.setTimeout(240 * 1000)

type Answer = { message?: string } & Record<string, unknown>
interface Listing {
  product_ids: string[]
  count: number
  facets: { price: { min: number; max: number } | null }
  message?: string
}

const DAY = 24 * 60 * 60 * 1000
let made = 0

const dayAhead = (days: number) => {
  const today = todayIn(new Date())
  return new Date(Date.parse(`${today}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10)
}

/**
 * adr/0077 §5 Ek "tarihli fiyat sırası": with dates the price sort and the
 * price filter read the card's price over the departures inside them;
 * without dates the index's price, as before.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }
    let store: Storefront
    let shop: StockShop

    const staff = (url: string, body: unknown) =>
      settle(http.post<Answer>(url, body, { headers: admin.headers }))
    const flag = (key: string, enabled: boolean) => staff(`/admin/features/${key}`, { enabled })

    /** A published tour at `price` TL a place, its departures `days` ahead, each its difference in lira. */
    const tour = async (price: number, departures: { days: number; difference?: number }[]) => {
      const { data } = await http.post<{
        product: { id: string; variants: { id: string }[] }
      }>(
        "/admin/products",
        {
          title: `Fiyat turu ${String((made += 1))}`,
          status: "draft",
          options: [{ title: "Kişi", values: ["Yetişkin"] }],
          variants: [
            {
              title: "Yetişkin",
              options: { Kişi: "Yetişkin" },
              prices: [{ currency_code: "try", amount: price }],
            },
          ],
          sales_channels: [{ id: shop.salesChannelId }],
        },
        { headers: admin.headers }
      )
      const productId = data.product.id
      const variantId = data.product.variants[0]?.id ?? ""
      await staff(`/admin/products/${productId}/catalog`, {
        kind: "service",
        booking_mode: "departure",
      })
      await staff(`/admin/products/${productId}`, { status: "published" })
      await staff(`/admin/products/${productId}/bookable`, { cutoff_hours: 24 })
      const created = await staff(`/admin/products/${productId}/booking-slots`, {
        slots: departures.map((each) => ({
          starts_at: new Date(Date.now() + each.days * DAY).toISOString(),
          capacity: 10,
          ...(each.difference === undefined
            ? {}
            : { price_adjustments: { [variantId]: each.difference } }),
        })),
      })
      expect(created.status).toBe(200)
      return productId
    }

    const listing = async (
      query: Record<string, string>,
      pricing: { region_id?: string; currency_code?: string } = {}
    ) => {
      await indexCatalogue(getContainer())
      return settle(
        http.get<Listing>(
          `/store/listings/products?${new URLSearchParams({
            type: "all",
            id: "all",
            region_id: pricing.region_id ?? shop.regionId,
            currency_code: pricing.currency_code ?? "try",
            query: new URLSearchParams(query).toString(),
          }).toString()}`,
          { headers: store.headers }
        )
      )
    }

    beforeEach(async () => {
      const container = getContainer()
      shop = await stockShop(container)
      store = await createStorefront(container)
      admin = await createAdminUser(http, container)
      await flag("catalog.non_physical", true)
      await flag("catalog.booking", true)
    })
    afterEach(async () => {
      await flag("catalog.booking", false)
      await flag("catalog.non_physical", false)
    })

    it("sorts and filters a date search by the price inside the dates, the index's without", async () => {
      // Cheap at base, but its one departure in the dates is 2.500 TL dearer (3.500 TL)
      const cheapBase = await tour(1000, [{ days: 10, difference: 2500 }, { days: 40 }])
      // Dearer at base, 1.500 TL inside the dates
      const plainPrice = await tour(1500, [{ days: 12 }])
      // Dates no other test file reads: a date search's products are kept 30 seconds
      const tarih = `${dayAhead(6)}_${dayAhead(19)}`

      const baseAsc = await listing({ sirala: "fiyat-artan" })
      const datedAsc = await listing({ tarih, sirala: "fiyat-artan" })
      const datedDesc = await listing({ tarih, sirala: "fiyat-azalan" })
      const datedCheap = await listing({ tarih, fiyat: "1000-2000" })
      const baseCheap = await listing({ fiyat: "900-1100" })

      expect(baseAsc.status).toBe(200)
      // Without dates: the index's price, the cheap base first, as before
      expect(baseAsc.data.product_ids.indexOf(cheapBase)).toBeLessThan(
        baseAsc.data.product_ids.indexOf(plainPrice)
      )
      expect(baseCheap.data.product_ids).toContain(cheapBase)
      expect(baseCheap.data.product_ids).not.toContain(plainPrice)
      // With dates: the cards' prices (1.500 and 3.500 TL)
      expect(datedAsc.data.product_ids).toEqual([plainPrice, cheapBase])
      expect(datedDesc.data.product_ids).toEqual([cheapBase, plainPrice])
      expect(datedAsc.data.facets.price).toEqual({ min: 1500, max: 3500 })
      expect(datedCheap.data.product_ids).toEqual([plainPrice])
      // Both read whole lira: the same bounds keep the index's 1.000 TL and the card's 1.500 TL alike
      const sameBoundsBase = await listing({ fiyat: "1000-1500" })
      const sameBoundsDated = await listing({ tarih, fiyat: "1000-1500" })
      expect(sameBoundsBase.data.product_ids).toEqual(
        expect.arrayContaining([cheapBase, plainPrice])
      )
      expect(sameBoundsDated.data.product_ids).toEqual([plainPrice])
    })

    it("refuses a date search priced in a region the shop has not, or in another currency", async () => {
      await tour(1500, [{ days: 9 }])
      const tarih = `${dayAhead(7)}_${dayAhead(18)}`

      const madeUp = await listing({ tarih }, { region_id: "reg_madeup1" })
      const otherCurrency = await listing({ tarih }, { currency_code: "usd" })
      const undated = await listing({}, { region_id: "reg_madeup1" })

      expect(madeUp.status).toBe(400)
      expect(madeUp.data.message).toBe("listing.region_unknown")
      expect(otherCurrency.status).toBe(400)
      expect(otherCurrency.data.message).toBe("listing.currency_mismatch")
      // Without dates nothing is priced on the server: answered as before
      expect(undated.status).toBe(200)
    })
  },
})
