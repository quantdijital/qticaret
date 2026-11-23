import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { clearUpcomingCaches } from "../../src/workflows/booking/upcoming"
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
interface Upcoming {
  currency: string
  departures: {
    product: { id: string; handle: string; title: string; thumbnail: string | null }
    slot_id: string
    starts_at: string
    timezone: string
    left: number | null
    from_price: number | null
  }[]
}

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
let made = 0

/** adr/0077 §10: the departures section's rows, the nearest bookable departures. */
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
     * A published tour at 1.500 TL a place in a sales channel (sales close
     * 24 hours before), its departures at these times, each with its
     * capacity and difference in lira.
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
          title: `Kalkış turu ${String((made += 1))}`,
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

    const upcoming = async (query: string) => {
      await indexCatalogue(getContainer())
      return settle(
        http.get<Upcoming & Answer>(`/store/departures?${query}`, { headers: store.headers })
      )
    }

    beforeEach(async () => {
      // The departures and the category tree are kept across sources and counts
      clearUpcomingCaches()
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

    it("answers as a missing route with the flag off, and refuses what it does not read", async () => {
      await flag("catalog.booking", false)
      const off = await upcoming("limit=6")
      await flag("catalog.booking", true)

      expect(off.status).toBe(404)
      expect((await upcoming("limit=2")).status).toBe(400)
      expect((await upcoming("limit=13")).status).toBe(400)
      expect((await upcoming("from_price=1")).status).toBe(400)
      expect((await upcoming("kategori=Yok%20Boyle")).status).toBe(400)
      expect((await upcoming("category_id=pcat_a&collection_id=pcol_b")).status).toBe(400)
      expect((await upcoming("")).status).toBe(200)
    })

    it("lists by date, two a tour, priced on the server, places only when few, cutoff kept", async () => {
      const now = Date.now()
      // Inside the 24-hour cutoff: not on sale any more
      const { productId: first, slotIds: firstSlots } = await tour([
        { at: now + 12 * HOUR },
        { at: now + 3 * DAY, capacity: 3, difference: -200 },
        { at: now + 4 * DAY },
        { at: now + 9 * DAY },
      ])
      const { slotIds: secondSlots } = await tour([{ at: now + 5 * DAY, difference: 250 }])
      // A closed departure is not offered
      const { slotIds: closedSlots } = await tour([{ at: now + 2 * DAY }])
      expect(
        (await staff(`/admin/booking-slots/${closedSlots[0] ?? ""}`, { status: "closed" })).status
      ).toBe(200)

      const answer = await upcoming("limit=12")

      expect(answer.status).toBe(200)
      expect(answer.headers["cache-control"]).toBe("no-store")
      expect(answer.data.currency).toBe("try")
      expect(
        answer.data.departures.map((each) => [each.slot_id, each.left, each.from_price])
      ).toEqual([
        [firstSlots[1], 3, 1300],
        [firstSlots[2], null, 1500],
        [secondSlots[0], null, 1750],
      ])
      expect(answer.data.departures[0]?.product).toMatchObject({ id: first, thumbnail: null })
      expect(answer.data.departures[0]?.timezone).toBe("Europe/Istanbul")
    })

    it("narrows to a category's subtree or a collection; never a draft or another channel's", async () => {
      const now = Date.now()
      const { productId: inside, slotIds: insideSlots } = await tour([{ at: now + 3 * DAY }])
      const { productId: collected, slotIds: collectedSlots } = await tour([{ at: now + 4 * DAY }])
      const channel = await staff("/admin/sales-channels", { name: "Başka kanal" })
      const otherChannel = (channel.data as { sales_channel: { id: string } }).sales_channel.id
      await tour([{ at: now + 2 * DAY }], otherChannel)
      const { productId: drafted } = await tour([{ at: now + 2 * DAY + HOUR }])
      expect((await staff(`/admin/products/${drafted}`, { status: "draft" })).status).toBe(200)
      const parent = await staff("/admin/product-categories", {
        name: "Doğa turları",
        handle: "doga-turlari",
        is_active: true,
      })
      const parentId = (parent.data as { product_category: { id: string } }).product_category.id
      const child = await staff("/admin/product-categories", {
        name: "Yayla",
        handle: "yayla",
        is_active: true,
        parent_category_id: parentId,
      })
      const childId = (child.data as { product_category: { id: string } }).product_category.id
      await staff(`/admin/products/${inside}`, { categories: [{ id: childId }] })
      const collection = await staff("/admin/collections", { title: "Yaz turları" })
      const collectionId = (collection.data as { collection: { id: string } }).collection.id
      await staff(`/admin/products/${collected}`, { collection_id: collectionId })

      const slots = (answer: { data: Upcoming }) =>
        answer.data.departures.map((each) => each.slot_id)
      expect(slots(await upcoming("limit=11"))).toEqual([insideSlots[0], collectedSlots[0]])
      expect(slots(await upcoming(`limit=10&category_id=${parentId}`))).toEqual([insideSlots[0]])
      expect(slots(await upcoming("limit=10&kategori=doga-turlari"))).toEqual([insideSlots[0]])
      expect(slots(await upcoming(`limit=10&collection_id=${collectionId}`))).toEqual([
        collectedSlots[0],
      ])
      const unknown = await upcoming("limit=10&collection_id=pcol_01YOKBOYLE")
      expect(unknown.status).toBe(200)
      expect(unknown.data.departures).toEqual([])
    })

    it("keeps an answer 30 seconds: a departure closed meanwhile shows until then", async () => {
      const { slotIds } = await tour([{ at: Date.now() + 6 * DAY }])
      const first = await upcoming("limit=7")
      const closed = await staff(`/admin/booking-slots/${slotIds[0] ?? ""}`, { status: "closed" })
      expect(closed.status).toBe(200)
      // Another count is cut from the same kept answer
      const again = await upcoming("limit=8")
      clearUpcomingCaches()
      const fresh = await upcoming("limit=8")

      expect(first.data.departures).toHaveLength(1)
      expect(again.data).toEqual(first.data)
      expect(fresh.data.departures).toEqual([])
    })
  },
})
