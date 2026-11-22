import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { todayIn } from "../../src/lib/seo/facets-dated"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { indexCatalogue } from "../helpers/search-index"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"

jest.setTimeout(240 * 1000)

type Answer = { message?: string } & Record<string, unknown>
interface Listing {
  product_ids: string[]
  count: number
  canonical_query?: string
  message?: string
}
interface Fact {
  booking?: Record<string, unknown>
}

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
let made = 0

// A day `days` after today in the shop's zone, as the search writes it
const dayAhead = (days: number) => {
  const today = todayIn(new Date())
  return new Date(Date.parse(`${today}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10)
}

/** adr/0077 §2–§4: searching dated products by dates, party and category. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }
    let store: Storefront
    let shop: StockShop

    const staff = (url: string, body: unknown) =>
      settle(http.post<Answer>(url, body, { headers: admin.headers }))
    const flag = (key: string, enabled: boolean) => staff(`/admin/features/${key}`, { enabled })

    /** A published tour at 1.500 TL a place, with departures `days` from now. */
    const tour = async (departures: { days: number; capacity: number }[]) => {
      const { data } = await http.post<{ product: { id: string } }>(
        "/admin/products",
        {
          title: `Kapadokya turu ${String((made += 1))}`,
          status: "draft",
          options: [{ title: "Kişi", values: ["Yetişkin"] }],
          variants: [
            {
              title: "Yetişkin",
              options: { Kişi: "Yetişkin" },
              prices: [{ currency_code: "try", amount: 1500 }],
            },
          ],
          sales_channels: [{ id: shop.salesChannelId }],
        },
        { headers: admin.headers }
      )
      const productId = data.product.id
      await staff(`/admin/products/${productId}/catalog`, {
        kind: "service",
        booking_mode: "departure",
      })
      await staff(`/admin/products/${productId}`, { status: "published" })
      await staff(`/admin/products/${productId}/bookable`, { cutoff_hours: 24 })
      const starts = departures.map((each) => new Date(Date.now() + each.days * DAY))
      const created = await staff(`/admin/products/${productId}/booking-slots`, {
        slots: departures.map((each, index) => ({
          starts_at: starts[index]?.toISOString(),
          capacity: each.capacity,
        })),
      })
      expect(created.status).toBe(200)
      return { productId, starts }
    }

    const listing = async (params: Record<string, string>, query: Record<string, string>) => {
      await indexCatalogue(getContainer())
      return settle(
        http.get<Listing>(
          `/store/listings/products?${new URLSearchParams({
            region_id: shop.regionId,
            currency_code: "try",
            query: new URLSearchParams(query).toString(),
            ...params,
          }).toString()}`,
          { headers: store.headers }
        )
      )
    }
    const search = (query: Record<string, string>) => listing({ type: "search" }, query)

    beforeEach(async () => {
      const container = getContainer()
      shop = await stockShop(container)
      store = await createStorefront(container)
      admin = await createAdminUser(http, container)
      await flag("catalog.non_physical", true)
      await flag("catalog.booking", true)
    })
    // Flags live in settings, whose cache outlives the database reset between tests
    afterEach(async () => {
      await flag("catalog.booking", false)
      await flag("catalog.non_physical", false)
    })

    it("finds tours by dates without words, the nearest departure first, room for the party", async () => {
      const later = await tour([{ days: 12, capacity: 10 }])
      const sooner = await tour([{ days: 7, capacity: 2 }])
      const outside = await tour([{ days: 40, capacity: 10 }])
      const plain = await stockedProduct(getContainer(), shop, `duz-${String((made += 1))}`, 5)
      const tarih = `${dayAhead(5)}_${dayAhead(20)}`

      const dated = await search({ tarih })
      const party = await search({ tarih, kisi: "3" })
      // A sort is no search by itself (adr/0077 §2): `kalkis` alone is read on the catalogue
      const bySort = await listing({ type: "all", id: "all" }, { sirala: "kalkis" })

      expect(dated.status).toBe(200)
      expect(dated.data.product_ids).toEqual([sooner.productId, later.productId])
      expect(dated.data).not.toHaveProperty("canonical_query")
      expect(party.data.product_ids).toEqual([later.productId])
      // Without dates `kalkis` orders, it does not narrow: dated first, the others after
      expect(bySort.data.product_ids.slice(0, 3)).toEqual([
        sooner.productId,
        later.productId,
        outside.productId,
      ])
      expect(bySort.data.product_ids).toContain(plain.productId)
      // A search with neither words, dates nor category is still refused; nor is a far date
      expect((await search({})).status).toBe(400)
      expect((await search({ sirala: "kalkis" })).status).toBe(400)
      expect((await search({ tarih: "9999-12-31_9999-12-31" })).status).toBe(400)
    })

    it("narrows a search to a category's subtree without words", async () => {
      const inside = await tour([{ days: 9, capacity: 10 }])
      await tour([{ days: 9, capacity: 10 }])
      const parent = await staff("/admin/product-categories", {
        name: "Doğa turları",
        handle: "doga-turlari",
        is_active: true,
      })
      const parentId = (parent.data as { product_category: { id: string } }).product_category.id
      const child = await staff("/admin/product-categories", {
        name: "Yürüyüş",
        handle: "yuruyus",
        is_active: true,
        parent_category_id: parentId,
      })
      const childId = (child.data as { product_category: { id: string } }).product_category.id
      await staff(`/admin/products/${inside.productId}`, { categories: [{ id: childId }] })

      const found = await search({ kategori: "doga-turlari" })
      const unknown = await search({ kategori: "yok-boyle" })

      expect(found.data.product_ids).toEqual([inside.productId])
      expect(unknown.status).toBe(200)
      expect(unknown.data.count).toBe(0)
    })

    it("drops the dates and the party with the flag off: the canonical query has none", async () => {
      const dated = await tour([{ days: 7, capacity: 10 }])
      const plain = await stockedProduct(getContainer(), shop, `duz-${String((made += 1))}`, 5)
      // Other dates than the test above: a date search's products are kept 30 seconds
      const tarih = `${dayAhead(4)}_${dayAhead(21)}`

      const on = await listing({ type: "all", id: "all" }, { tarih, kisi: "2" })
      await flag("catalog.booking", false)
      const off = await listing({ type: "all", id: "all" }, { tarih, kisi: "2" })
      const offSearch = await search({ tarih })

      expect(on.data.product_ids).toEqual([dated.productId])
      expect(on.data).not.toHaveProperty("canonical_query")
      expect(off.status).toBe(200)
      expect(off.data.product_ids).toContain(plain.productId)
      expect(off.data.canonical_query).toBe("")
      // A search by dates alone is no search while dates are not read
      expect(offSearch.status).toBe(400)
    })

    it("says a card's departure, places and price inside the dates; without them as before", async () => {
      const { productId, starts } = await tour([
        { days: 3, capacity: 10 },
        { days: 15, capacity: 4 },
      ])
      const cards = async (extra: string) => {
        const answer = await settle(
          http.get<{ facts: Record<string, Fact> }>(
            `/store/card-facts?id=${productId}&region_id=${shop.regionId}${extra}`,
            { headers: store.headers }
          )
        )
        return answer
      }

      const plain = await cards("")
      const ranged = await cards(`&from=${dayAhead(10)}&to=${dayAhead(20)}&pax=2`)
      const crowd = await cards(`&from=${dayAhead(10)}&to=${dayAhead(20)}&pax=5`)
      const past = await cards(`&from=2020-01-01&to=2020-01-05`)
      const far = await cards(`&from=9999-12-31&to=9999-12-31`)

      expect(plain.data.facts[productId]?.booking).toEqual({
        from_price: 1500,
        currency_code: "try",
        next_departure: starts[0]?.toISOString(),
        timezone: "Europe/Istanbul",
      })
      expect(ranged.data.facts[productId]?.booking).toEqual({
        from_price: 1500,
        currency_code: "try",
        next_departure: starts[1]?.toISOString(),
        timezone: "Europe/Istanbul",
        left: 4,
        in_range: true,
      })
      expect(crowd.data.facts[productId]?.booking).toMatchObject({
        next_departure: null,
        left: null,
        in_range: true,
      })
      expect(past.status).toBe(400)
      expect(far.status).toBe(400)
    })
  },
})
