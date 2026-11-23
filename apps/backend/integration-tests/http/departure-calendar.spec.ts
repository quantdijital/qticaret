import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
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
interface Calendar {
  month: string
  currency: string
  days: { date: string; from_price: number | null; departures: number }[]
}

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
let made = 0

// The month after next, in UTC: inside the twelve a search reads, no departure in it closed
function monthAhead(): { month: string; firstUtc: number } {
  const now = new Date()
  const first = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 2, 1)
  return { month: new Date(first).toISOString().slice(0, 7), firstUtc: first }
}
const dayOf = (time: number) => new Date(time).toISOString().slice(0, 10)

/** adr/0077 §6: a month's departures by day, priced on the server. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }
    let store: Storefront
    let shop: StockShop

    const staff = (url: string, body: unknown) =>
      settle(http.post<Answer>(url, body, { headers: admin.headers }))
    const flag = (key: string, enabled: boolean) => staff(`/admin/features/${key}`, { enabled })

    /**
     * A published tour at 1.500 TL a place in a sales channel, its
     * departures at these times, each with its difference in lira.
     */
    const tour = async (
      departures: { at: number; capacity?: number; difference?: number }[],
      channelId: string = shop.salesChannelId
    ) => {
      const { data } = await http.post<{
        product: { id: string; variants: { id: string }[] }
      }>(
        "/admin/products",
        {
          title: `Takvim turu ${String((made += 1))}`,
          status: "draft",
          options: [{ title: "Kişi", values: ["Yetişkin"] }],
          variants: [
            {
              title: "Yetişkin",
              options: { Kişi: "Yetişkin" },
              prices: [{ currency_code: "try", amount: 1500 }],
            },
          ],
          sales_channels: [{ id: channelId }],
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
          starts_at: new Date(each.at).toISOString(),
          capacity: each.capacity ?? 10,
          ...(each.difference === undefined
            ? {}
            : { price_adjustments: { [variantId]: each.difference } }),
        })),
      })
      expect(created.status).toBe(200)
      const slots = (created.data as { slots?: { id: string }[] }).slots ?? []
      return { productId, slotIds: slots.map((slot) => slot.id) }
    }

    const calendar = async (query: string) => {
      await indexCatalogue(getContainer())
      return settle(
        http.get<Calendar & Answer>(`/store/departures/calendar?${query}`, {
          headers: store.headers,
        })
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
    // Flags live in settings, whose cache outlives the database reset between tests
    afterEach(async () => {
      await flag("catalog.booking", false)
      await flag("catalog.non_physical", false)
    })

    it("answers as a missing route with the flag off, and refuses a month no search reads", async () => {
      const { month } = monthAhead()
      await flag("catalog.booking", false)
      const off = await calendar(`month=${month}`)
      await flag("catalog.booking", true)

      expect(off.status).toBe(404)
      expect((await calendar("month=2026-13")).status).toBe(400)
      expect((await calendar("month=2020-01")).status).toBe(400)
      expect((await calendar("month=9999-12")).status).toBe(400)
      expect((await calendar(`month=${month}&kisi=21`)).status).toBe(400)
      expect((await calendar(`month=${month}&kategori=Yok%20Boyle`)).status).toBe(400)
      expect((await calendar(`month=${month}&fiyat=1`)).status).toBe(400)
      expect((await calendar("")).status).toBe(400)
    })

    it("gives each day its departures and lowest price, differences added, the party's room only", async () => {
      const { month, firstUtc } = monthAhead()
      // 09:00 in Istanbul on the 5th and the 12th
      const fifth = firstUtc + 4 * DAY + 6 * HOUR
      const twelfth = firstUtc + 11 * DAY + 6 * HOUR
      await tour([
        { at: fifth, difference: -200 },
        { at: twelfth, capacity: 2 },
      ])
      await tour([{ at: fifth + 3 * HOUR, difference: 250 }])

      const all = await calendar(`month=${month}`)
      const party = await calendar(`month=${month}&kisi=3`)

      expect(all.status).toBe(200)
      expect(all.headers["cache-control"]).toBe("no-store")
      expect(all.data).toEqual({
        month,
        currency: "try",
        days: [
          { date: dayOf(firstUtc + 4 * DAY), from_price: 1300, departures: 2 },
          { date: dayOf(firstUtc + 11 * DAY), from_price: 1500, departures: 1 },
        ],
      })
      // Two places left on the 12th: a party of three has only the 5th
      expect(party.data.days.map((each) => each.date)).toEqual([dayOf(firstUtc + 4 * DAY)])
    })

    it("narrows to a category's subtree; never counts a draft or another channel's tour", async () => {
      const { month, firstUtc } = monthAhead()
      const { productId: inside } = await tour([{ at: firstUtc + 6 * DAY + 6 * HOUR }])
      await tour([{ at: firstUtc + 7 * DAY + 6 * HOUR }])
      const channel = await staff("/admin/sales-channels", { name: "Başka kanal" })
      const otherChannel = (channel.data as { sales_channel: { id: string } }).sales_channel.id
      await tour([{ at: firstUtc + 8 * DAY + 6 * HOUR }], otherChannel)
      // Taken back to draft: no longer sold, its departures count nowhere
      const { productId: drafted } = await tour([{ at: firstUtc + 9 * DAY + 6 * HOUR }])
      expect((await staff(`/admin/products/${drafted}`, { status: "draft" })).status).toBe(200)
      const parent = await staff("/admin/product-categories", {
        name: "Kültür turları",
        handle: "kultur-turlari",
        is_active: true,
      })
      const parentId = (parent.data as { product_category: { id: string } }).product_category.id
      const child = await staff("/admin/product-categories", {
        name: "Müze",
        handle: "muze",
        is_active: true,
        parent_category_id: parentId,
      })
      const childId = (child.data as { product_category: { id: string } }).product_category.id
      await staff(`/admin/products/${inside}`, { categories: [{ id: childId }] })

      const all = await calendar(`month=${month}&kisi=2`)
      const narrowed = await calendar(`month=${month}&kategori=kultur-turlari&kisi=2`)
      const unknown = await calendar(`month=${month}&kategori=yok-boyle&kisi=2`)

      expect(all.data.days.map((each) => each.date)).toEqual([
        dayOf(firstUtc + 6 * DAY),
        dayOf(firstUtc + 7 * DAY),
      ])
      expect(narrowed.data.days).toEqual([
        { date: dayOf(firstUtc + 6 * DAY), from_price: 1500, departures: 1 },
      ])
      expect(unknown.status).toBe(200)
      expect(unknown.data.days).toEqual([])
    })

    it("keeps a month's answer a minute: a departure closed meanwhile shows until then", async () => {
      const { month, firstUtc } = monthAhead()
      const { slotIds } = await tour([{ at: firstUtc + 14 * DAY + 6 * HOUR }])
      // A party no other test asks: its own cache entry
      const first = await calendar(`month=${month}&kisi=7`)
      const closed = await staff(`/admin/booking-slots/${slotIds[0] ?? ""}`, { status: "closed" })
      expect(closed.status).toBe(200)
      const again = await calendar(`month=${month}&kisi=7`)
      const fresh = await calendar(`month=${month}&kisi=6`)

      expect(first.data.days).toHaveLength(1)
      expect(again.data).toEqual(first.data)
      expect(fresh.data.days).toEqual([])
    })
  },
})
