import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"

jest.setTimeout(180 * 1000)

type Answer = { message?: string } & Record<string, unknown>
interface Fact {
  stock: string
  quick_add: { variant_id: string } | null
  booking?: {
    from_price: number | null
    currency_code: string
    next_departure: string | null
    timezone: string
  }
}

const HOUR = 60 * 60 * 1000
let made = 0

/** adr/0076 §10: a dated product's card says its from price and next departure. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }
    let store: Storefront
    let shop: StockShop

    const staff = (url: string, body: unknown) =>
      settle(http.post<Answer>(url, body, { headers: admin.headers }))
    const flag = (key: string, enabled: boolean) => staff(`/admin/features/${key}`, { enabled })
    const facts = async (ids: string[], region = true) => {
      const query = [
        ...ids.map((id) => `id=${id}`),
        ...(region ? [`region_id=${shop.regionId}`] : []),
      ].join("&")
      const answer = await settle(
        http.get<{ facts: Record<string, Fact> }>(`/store/card-facts?${query}`, {
          headers: store.headers,
        })
      )
      expect(answer.status).toBe(200)
      return answer.data.facts
    }

    /**
     * A published tour: an adult at 1.500 TL and an infant at 0 TL who
     * takes no place, with the departures given (hours
     * from now); sales close 24 hours before each.
     */
    const tour = async (
      departures: { hours: number; capacity: number; status?: "open" | "closed" }[],
      adjustment = 0
    ) => {
      const { data } = await http.post<{
        product: { id: string; variants: { id: string; title: string }[] }
      }>(
        "/admin/products",
        {
          title: `Ege turu ${String((made += 1))}`,
          status: "draft",
          options: [{ title: "Kişi", values: ["Yetişkin", "Bebek"] }],
          variants: [
            {
              title: "Yetişkin",
              options: { Kişi: "Yetişkin" },
              prices: [{ currency_code: "try", amount: 1500 }],
            },
            {
              title: "Bebek",
              options: { Kişi: "Bebek" },
              prices: [{ currency_code: "try", amount: 0 }],
            },
          ],
          sales_channels: [{ id: shop.salesChannelId }],
        },
        { headers: admin.headers }
      )
      const productId = data.product.id
      const adult = data.product.variants.find((variant) => variant.title === "Yetişkin")?.id ?? ""
      const infant = data.product.variants.find((variant) => variant.title === "Bebek")?.id ?? ""
      await staff(`/admin/products/${productId}/catalog`, {
        kind: "service",
        booking_mode: "departure",
      })
      await staff(`/admin/products/${productId}`, { status: "published" })
      await staff(`/admin/products/${productId}/bookable`, {
        cutoff_hours: 24,
        pax_by_variant: { [infant]: { pax: 0, max_age: 2 } },
      })
      const starts = departures.map((each) => new Date(Date.now() + each.hours * HOUR))
      if (departures.length > 0) {
        const created = await staff(`/admin/products/${productId}/booking-slots`, {
          slots: departures.map((each, index) => ({
            starts_at: starts[index]?.toISOString(),
            capacity: each.capacity,
            ...(each.status ? { status: each.status } : {}),
            ...(adjustment ? { price_adjustments: { [adult]: adjustment } } : {}),
          })),
        })
        expect(created.status).toBe(200)
      }
      return { productId, starts }
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

    it("says the nearest departure on sale and the lowest paying price, and nothing with the flag off", async () => {
      const container = getContainer()
      const { productId, starts } = await tour(
        [
          // Inside the 24 hours' close, then full, then closed by staff: none of them on sale
          { hours: 6, capacity: 10 },
          { hours: 2 * 24, capacity: 0 },
          { hours: 3 * 24, capacity: 10, status: "closed" },
          { hours: 10 * 24, capacity: 10 },
        ],
        250.5
      )
      const plain = await stockedProduct(container, shop, `kart-duz-${String((made += 1))}`, 5)

      const on = await facts([productId, plain.productId])
      const lira = await facts([productId], false)
      await flag("catalog.booking", false)
      const off = await facts([productId, plain.productId])

      expect(on[productId]?.booking).toEqual({
        from_price: 1750.5,
        currency_code: "try",
        next_departure: starts[3]?.toISOString(),
        timezone: "Europe/Istanbul",
      })
      expect(on[productId]?.quick_add).toBeNull()
      // An ordinary product's card is as it was
      expect(on[plain.productId]).not.toHaveProperty("booking")
      expect(lira[productId]?.booking?.from_price).toBe(1750.5)
      expect(off[productId]).not.toHaveProperty("booking")
      expect(off[plain.productId]).not.toHaveProperty("booking")
    })

    it("keeps the from price without a departure on sale, and refuses an odd region id", async () => {
      const { productId } = await tour([{ hours: 5 * 24, capacity: 0 }])
      const bare = await tour([])

      const read = await facts([productId, bare.productId])
      const odd = await settle(
        http.get(`/store/card-facts?id=${productId}&region_id=not-a-region`, {
          headers: store.headers,
        })
      )

      expect(read[productId]?.booking).toMatchObject({ from_price: 1500, next_departure: null })
      expect(read[bare.productId]?.booking).toMatchObject({
        from_price: 1500,
        next_departure: null,
      })
      expect(odd.status).toBe(400)
    })

    it("says a tour's length from its length attribute, and nothing without one (adr/0077 Ek)", async () => {
      const { productId } = await tour([{ hours: 5 * 24, capacity: 4 }])
      const bare = await tour([{ hours: 5 * 24, capacity: 4 }])
      const template = await staff("/admin/attribute-templates", {
        name: "Tur bilgileri",
        handle: `tur-bilgileri-${String((made += 1))}`,
        definitions: [{ key: "sure", label: "Süre", type: "number", unit: "gün" }],
      })
      expect(template.status).toBe(200)
      const templateId = (template.data["attribute_template"] as { id: string }).id
      const saved = await staff(`/admin/products/${productId}/attributes`, {
        template_id: templateId,
        values: { sure: 5 },
      })
      expect(saved.status).toBe(200)

      const read = await facts([productId, bare.productId])

      expect(read[productId]?.booking).toMatchObject({ duration_days: 5 })
      expect(read[bare.productId]?.booking).not.toHaveProperty("duration_days")
    })
  },
})
