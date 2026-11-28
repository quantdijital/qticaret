import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  batchLinkProductsToCategoryWorkflow,
  createCartWorkflow,
} from "@medusajs/medusa/core-flows"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { sectorPack } from "@qticaret/sector-packs"
import { applySectorPack } from "../../src/lib/sector-packs/apply"
import { BOOKING_MODULE } from "../../src/modules/booking"
import type BookingModuleService from "../../src/modules/booking/service"
import { PRODUCT_REVIEWS_MODULE } from "../../src/modules/product-reviews"
import type ProductReviewsModuleService from "../../src/modules/product-reviews/service"
import { setFeatureFlagWorkflow } from "../../src/workflows/platform-settings/set-feature-flag"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { stockShop } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront, createTestProduct } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"

jest.setTimeout(300 * 1000)

type Answer = { message?: string } & Record<string, unknown>
interface Status {
  sets: { pack: string; products: number; loaded: boolean }[]
  catalog_empty: boolean
  products: { id: string; title: string; blocked: string | null }[]
  categories: number
  reviews: number
}
interface LoadJob {
  status: string
  progress: number
  pack: string | null
  summary: Record<string, unknown> | null
  error_code: string | null
}

const found = sectorPack("travel")
if (!found) {
  throw new Error("the travel pack is missing")
}
const travel = found
const SET_SIZE = travel.samples?.products.length ?? 0

/**
 * The sector pack's sample catalogue (owner, 2026-11-28): loaded once,
 * every record marked; never sold (the cart and the booking route refuse
 * it); removed by parts, only what it made, a category holding a product
 * of the shop's kept and named; owner and admin only.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    const container = (): MedusaContainer => getContainer()
    let admin: { headers: Record<string, string> }
    let store: Storefront
    let shop: StockShop

    const post = (url: string, body: unknown, headers = admin.headers) =>
      settle(http.post<Answer>(url, body, { headers }))
    const status = async () => {
      const { data } = await http.get<{ sample_catalog: Status }>("/admin/sample-catalog", {
        headers: admin.headers,
      })
      return data.sample_catalog
    }
    // The load is a background job: queued (202), then polled on the status
    const load = async (): Promise<LoadJob> => {
      const queued = await post("/admin/sample-catalog/load", { pack: "travel" })
      expect(queued.status).toBe(202)
      for (let attempt = 0; attempt < 1200; attempt++) {
        const { data } = await http.get<{ load_job: LoadJob | null }>("/admin/sample-catalog", {
          headers: admin.headers,
        })
        const job = data.load_job
        if (job && job.status !== "queued" && job.status !== "running") {
          return job
        }
        await new Promise((resolve) => setTimeout(resolve, 200))
      }
      throw new Error("the sample load did not finish")
    }

    beforeEach(async () => {
      shop = await stockShop(container())
      store = await createStorefront(container())
      admin = await createAdminUser(http, container())
      await applySectorPack(container(), travel)
    })
    // Flags live in a cache that outlives the database reset between tests
    afterEach(async () => {
      for (const key of ["catalog.booking", "catalog.non_physical"]) {
        await setFeatureFlagWorkflow(container()).run({
          input: { key, enabled: false, actor_id: null },
        })
      }
    })

    it("loads the set once, marked, and refuses it in a cart and on the booking route", async () => {
      const before = await status()
      expect(before.sets).toEqual([
        expect.objectContaining({ pack: "travel", products: SET_SIZE, loaded: false }),
      ])

      const loaded = await load()
      expect(loaded).toMatchObject({
        status: "succeeded",
        progress: 100,
        pack: "travel",
        summary: { pack: "travel", products: SET_SIZE },
      })
      const after = await status()
      expect(after.products).toHaveLength(SET_SIZE)
      expect(after.sets[0]?.loaded).toBe(true)
      expect(after.reviews).toBeGreaterThan(0)

      const again = await post("/admin/sample-catalog/load", { pack: "travel" })
      expect([again.status, again.data.message]).toEqual([400, "sample_catalog.already_loaded"])

      const tourId = after.products[0]?.id ?? ""
      const query = container().resolve(ContainerRegistrationKeys.QUERY)
      const { data } = await query.graph({
        entity: "product",
        fields: ["variants.id"],
        filters: { id: tourId },
      })
      const variantId = (data[0] as { variants: { id: string }[] }).variants[0]?.id ?? ""
      const booking = container().resolve<BookingModuleService>(BOOKING_MODULE)
      const [bookable] = await booking.listBookables({ product_id: tourId })
      const slots = await booking.listBookingSlots({ bookable_id: bookable?.id ?? "" })
      expect(slots.length).toBeGreaterThan(0)

      const { result: cart } = await createCartWorkflow(container()).run({
        input: {
          region_id: shop.regionId,
          sales_channel_id: shop.salesChannelId,
          currency_code: "try",
        },
      })
      const plain = await post(
        `/store/carts/${cart.id}/line-items`,
        { variant_id: variantId, quantity: 1 },
        store.headers
      )
      const madeWith = await post(
        "/store/carts",
        { region_id: shop.regionId, items: [{ variant_id: variantId, quantity: 1 }] },
        store.headers
      )
      const booked = await post(
        `/store/carts/${cart.id}/bookings`,
        { slot_id: slots[0]?.id, items: [{ variant_id: variantId, quantity: 1 }] },
        store.headers
      )
      for (const refused of [plain, madeWith, booked]) {
        expect([refused.status, refused.data.message]).toEqual([400, "sample_catalog.not_for_sale"])
      }
      // The booking route's hold is given back with the refusal
      const [slot] = await booking.slotAvailability([slots[0]?.id ?? ""])
      expect(slot).toMatchObject({ held: 0, sold: 0 })
    })

    it("removes by parts only what it made, and keeps a category holding the shop's product", async () => {
      expect((await load()).status).toBe("succeeded")
      const products = container().resolve(Modules.PRODUCT)
      const [sampleCategory] = await products.listProductCategories(
        { handle: "kapadokya-turlari" },
        { select: ["id", "metadata"] }
      )
      expect(sampleCategory?.metadata?.["sample_of"]).toBe(sampleCategory?.id)
      const ownVariant = await createTestProduct(container(), store.salesChannelId, {
        handle: "kendi-turumuz",
        price: 1000,
      })
      const [ownVariantRow] = await products.listProductVariants(
        { id: ownVariant },
        { select: ["product_id"] }
      )
      const ownProductId = ownVariantRow?.product_id ?? ""
      await batchLinkProductsToCategoryWorkflow(container()).run({
        input: { id: sampleCategory?.id ?? "", add: [ownProductId], remove: [] },
      })
      const loaded = await status()
      const kept = loaded.products[0]?.id ?? ""

      const reviewsOnly = await post("/admin/sample-catalog/remove", {
        parts: ["reviews"],
        dry_run: true,
      })
      expect(reviewsOnly.data["plan"]).toMatchObject({
        products: 0,
        categories: 0,
        reviews: loaded.reviews,
      })

      const plan = await post("/admin/sample-catalog/remove", {
        parts: ["products", "categories", "reviews"],
        keep_product_ids: [kept],
        dry_run: true,
      })
      expect(plan.data["plan"]).toMatchObject({ products: SET_SIZE - 1 })

      const removed = await post("/admin/sample-catalog/remove", {
        parts: ["products", "categories", "reviews"],
      })
      expect(removed.status).toBe(200)
      expect(removed.data["result"]).toMatchObject({
        products: SET_SIZE,
        reviews: loaded.reviews,
        categories_kept: [
          { id: sampleCategory?.id, name: "Kapadokya Turları", reason: "own_products" },
        ],
      })
      const after = await status()
      expect(after).toMatchObject({ products: [], reviews: 0 })
      // The shop's own product and the category it holds stay; the demo seed's products too
      expect(await products.listProducts({ id: ownProductId })).toHaveLength(1)
      expect(await products.listProductCategories({ id: sampleCategory?.id ?? "" })).toHaveLength(1)
      const reviews = await container()
        .resolve<ProductReviewsModuleService>(PRODUCT_REVIEWS_MODULE)
        .listProductReviews({ source_ref: { $like: "sample:%" } })
      expect(reviews).toHaveLength(0)
    })

    it("is the owner's and admin's: operations staff are turned away", async () => {
      const operations = await createAdminUser(http, container(), "operations")
      const read = await settle(
        http.get<Answer>("/admin/sample-catalog", { headers: operations.headers })
      )
      const load = await post("/admin/sample-catalog/load", { pack: "travel" }, operations.headers)
      expect([read.status, load.status]).toEqual([403, 403])
      const unknown = await post("/admin/sample-catalog/load", { pack: "cutlery" })
      expect(unknown.status).toBe(404)
      const loose = await post("/admin/sample-catalog/remove", { parts: [], extra: 1 })
      expect(loose.status).toBe(400)
    })
  },
})
