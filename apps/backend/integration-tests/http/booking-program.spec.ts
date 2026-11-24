import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminUser } from "../helpers/admin"
import { publishTour } from "../helpers/booking-tour"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { stockShop } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"

jest.setTimeout(180 * 1000)

type Answer = Record<string, unknown>

const paragraph = (text: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
})

const PROGRAM = {
  unit: "day",
  steps: [
    {
      title: "Varış ve şehir turu",
      body: paragraph("Havalimanında karşılama, <b>akşam</b> yemeği."),
      tags: ["dinner", "transport", "dinner"],
    },
    { label: "Serbest gün", title: "Kapadokya", tags: [] },
  ],
}

/**
 * adr/0078: a dated product's program, written whole by its editors,
 * read by its page behind `catalog.booking`; recorded in the audit log
 * without its words; its steps the trip's itinerary.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }
    let store: Storefront
    let shop: StockShop

    const post = (url: string, body: unknown, headers = admin.headers) =>
      settle(http.post<Answer>(url, body, { headers }))
    const get = (url: string, headers: Record<string, string>) =>
      settle(http.get<Answer>(url, { headers }))
    const flag = (key: string, enabled: boolean) => post(`/admin/features/${key}`, { enabled })

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

    it("saves the steps whole and reads them back, tags once each in the list's order", async () => {
      const tour = await publishTour(http, admin.headers, shop, "none")
      const empty = await get(`/admin/products/${tour.productId}/program`, admin.headers)
      expect(empty.status).toBe(200)
      expect(empty.data["program"]).toEqual({ unit: "day", steps: [] })

      const saved = await post(`/admin/products/${tour.productId}/program`, PROGRAM)
      expect(saved.status).toBe(200)
      const program = saved.data["program"] as { steps: Answer[] }
      expect(program.steps).toHaveLength(2)
      expect(program.steps[0]).toMatchObject({
        label: null,
        title: "Varış ve şehir turu",
        tags: ["dinner", "transport"],
        image: null,
      })
      expect(program.steps[1]).toMatchObject({ label: "Serbest gün", body: null })

      // No steps clears it
      const cleared = await post(`/admin/products/${tour.productId}/program`, {
        unit: "step",
        steps: [],
      })
      expect(cleared.data["program"]).toEqual({ unit: "day", steps: [] })
    })

    it("refuses a step without a title, a tag off the list, a heading, a 31st step, an outside picture", async () => {
      const tour = await publishTour(http, admin.headers, shop, "none")
      const url = `/admin/products/${tour.productId}/program`
      const refused = await Promise.all([
        post(url, { unit: "day", steps: [{ title: " " }] }),
        post(url, { unit: "day", steps: [{ title: "A", tags: ["spa"] }] }),
        post(url, {
          unit: "day",
          steps: [
            {
              title: "A",
              body: {
                type: "doc",
                content: [
                  {
                    type: "heading",
                    attrs: { level: 2 },
                    content: [{ type: "text", text: "Büyük" }],
                  },
                ],
              },
            },
          ],
        }),
        post(url, {
          unit: "day",
          steps: Array.from({ length: 31 }, (_, n) => ({ title: `Gün ${String(n)}` })),
        }),
        // An address that is not one of the media library's uploads
        post(url, {
          unit: "day",
          steps: [{ title: "A", image: { url: "https://cdn.example.com/a.jpg", alt: null } }],
        }),
      ])
      expect(refused.map((answer) => answer.status)).toEqual([400, 400, 400, 400, 400])
      expect(refused[4].data["code"] ?? refused[4].data["message"]).toBe(
        "booking.program_image_unknown"
      )
    })

    it("refuses a product that is not sold by date", async () => {
      const { data } = await http.post<{ product: { id: string } }>(
        "/admin/products",
        { title: "Bıçak", options: [{ title: "Boy", values: ["Tek"] }] },
        { headers: admin.headers }
      )
      const answer = await post(`/admin/products/${data.product.id}/program`, PROGRAM)
      expect(answer.status).toBe(400)
    })

    it("keeps the program the product editors': operations staff are refused", async () => {
      const tour = await publishTour(http, admin.headers, shop, "none")
      const ops = await createAdminUser(http, getContainer(), "operations")
      const answer = await post(`/admin/products/${tour.productId}/program`, PROGRAM, ops.headers)
      expect(answer.status).toBe(403)
      // Every role reads it
      expect((await get(`/admin/products/${tour.productId}/program`, ops.headers)).status).toBe(200)
    })

    it("gives the page its steps, bodies rendered and escaped; none for a product without", async () => {
      const tour = await publishTour(http, admin.headers, shop, "none")
      const url = `/store/products/${tour.productId}/program`
      expect((await get(url, store.headers)).data["program"]).toBeNull()

      await post(`/admin/products/${tour.productId}/program`, PROGRAM)
      const answer = await get(url, store.headers)
      expect(answer.status).toBe(200)
      const program = answer.data["program"] as { unit: string; steps: Answer[] }
      expect(program.unit).toBe("day")
      expect(program.steps[0]?.["body_html"]).toBe(
        "<p>Havalimanında karşılama, &lt;b&gt;akşam&lt;/b&gt; yemeği.</p>"
      )
      expect(program.steps[1]?.["body_html"]).toBeNull()
    })

    it("answers as if the routes did not exist while dated products are off, and for a draft", async () => {
      const tour = await publishTour(http, admin.headers, shop, "none")
      await post(`/admin/products/${tour.productId}/program`, PROGRAM)
      await post(`/admin/products/${tour.productId}`, { status: "draft" })
      expect((await get(`/store/products/${tour.productId}/program`, store.headers)).status).toBe(
        404
      )
      await post(`/admin/products/${tour.productId}`, { status: "published" })
      await flag("catalog.booking", false)
      expect((await get(`/store/products/${tour.productId}/program`, store.headers)).status).toBe(
        404
      )
      expect((await get(`/admin/products/${tour.productId}/program`, admin.headers)).status).toBe(
        404
      )
    })

    it("names the steps as the trip's itinerary in its structured data", async () => {
      await post("/admin/platform-settings/seo", { canonical_host: "ornek.com" })
      const tour = await publishTour(http, admin.headers, shop, "none")
      await post(`/admin/products/${tour.productId}/program`, PROGRAM)
      const { data } = await http.get<{ product: { handle: string } }>(
        `/admin/products/${tour.productId}?fields=handle`,
        { headers: admin.headers }
      )
      const resolved = await get(
        `/store/seo/resolve?path=${encodeURIComponent(`/urun/${data.product.handle}`)}`,
        store.headers
      )
      const blocks = (resolved.data["seo"] as { jsonLd?: Answer[] } | undefined)?.jsonLd ?? []
      const trip = blocks.find((block) => block["@type"] === "TouristTrip")
      expect(trip?.["itinerary"]).toEqual({
        "@type": "ItemList",
        numberOfItems: 2,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Varış ve şehir turu",
            description: "Havalimanında karşılama, <b>akşam</b> yemeği.",
          },
          { "@type": "ListItem", position: 2, name: "Kapadokya" },
        ],
      })
    })
  },
})
