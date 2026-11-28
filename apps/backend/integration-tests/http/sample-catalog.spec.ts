import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  batchLinkProductsToCategoryWorkflow,
  createCartWorkflow,
} from "@medusajs/medusa/core-flows"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { sectorPack } from "@qticaret/sector-packs"
import { applySectorPack } from "../../src/lib/sector-packs/apply"
import { SAMPLE_LOAD_JOB } from "../../src/lib/sample-catalog/load-job"
import { ASYNC_JOB_MODULE } from "../../src/modules/async-job"
import type AsyncJobModuleService from "../../src/modules/async-job/service"
import { BOOKING_MODULE } from "../../src/modules/booking"
import type BookingModuleService from "../../src/modules/booking/service"
import { PRODUCT_REVIEWS_MODULE } from "../../src/modules/product-reviews"
import type ProductReviewsModuleService from "../../src/modules/product-reviews/service"
import { URL_REGISTRY_MODULE } from "../../src/modules/url-registry"
import type UrlRegistryModuleService from "../../src/modules/url-registry/service"
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
  products: { id: string; title: string; handle: string; blocked: string | null }[]
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
    // The load is a background job: queued (202), then polled by the job alone (`?job=1`)
    const load = async (): Promise<LoadJob> => {
      const queued = await post("/admin/sample-catalog/load", { pack: "travel" })
      expect(queued.status).toBe(202)
      for (let attempt = 0; attempt < 600; attempt++) {
        const { data } = await http.get<{ load_job: LoadJob | null }>(
          "/admin/sample-catalog?job=1",
          { headers: admin.headers }
        )
        // The light answer reads no catalogue
        expect(data).not.toHaveProperty("sample_catalog")
        const job = data.load_job
        if (job && job.status !== "queued" && job.status !== "running") {
          return job
        }
        await new Promise((resolve) => setTimeout(resolve, 500))
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
      // A sample's address goes back to the pool (no 410 holds it): the set loads again as it was
      const paths = await container()
        .resolve<UrlRegistryModuleService>(URL_REGISTRY_MODULE)
        .listUrlEntries({ entity_id: loaded.products.map((each) => each.id) })
      expect(paths).toHaveLength(0)
      expect((await load()).status).toBe("succeeded")
      const again = await status()
      expect(again.products.map((each) => each.handle).sort()).toEqual(
        loaded.products.map((each) => each.handle).sort()
      )
    })

    it("takes a half made record for a sample only from a load that did not finish", async () => {
      // Security review 2026-11-28, D1: the tag alone, or a job that succeeded, is the shop's
      const jobs = container().resolve<AsyncJobModuleService>(ASYNC_JOB_MODULE)
      const [stopped, finished] = await jobs.createAsyncJobs([
        {
          type: SAMPLE_LOAD_JOB,
          status: "failed",
          input: { pack: "travel" },
          error_code: "failed",
        },
        { type: SAMPLE_LOAD_JOB, status: "succeeded", input: { pack: "travel" } },
      ])
      const products = container().resolve(Modules.PRODUCT)
      const [halfMade, forged, tagOnly] = await products.createProducts([
        {
          title: "Yarım kalan",
          handle: "yarim-kalan",
          metadata: { sample: "travel@1", sample_job: stopped?.id ?? "" },
        },
        {
          title: "Taklit",
          handle: "taklit",
          metadata: { sample: "travel@1", sample_job: finished?.id ?? "" },
        },
        { title: "Etiketli", handle: "etiketli", metadata: { sample: "travel@1" } },
      ])
      const ids = (await status()).products.map((each) => each.id)
      expect(ids).toContain(halfMade?.id)
      expect(ids).not.toContain(forged?.id)
      expect(ids).not.toContain(tagOnly?.id)
      const removed = await post("/admin/sample-catalog/remove", { parts: ["products"] })
      expect(removed.data["result"]).toMatchObject({ products: 1 })
      expect(
        await products.listProducts({ id: [forged?.id ?? "", tagOnly?.id ?? ""] })
      ).toHaveLength(2)
    })

    it("keeps the sample marks the server's on Medusa's product and category routes", async () => {
      const ownVariant = await createTestProduct(container(), store.salesChannelId, {
        handle: "kendi-urunumuz",
        price: 1000,
      })
      const [row] = await container()
        .resolve(Modules.PRODUCT)
        .listProductVariants({ id: ownVariant }, { select: ["product_id"] })
      const own = row?.product_id ?? ""
      const refused = [
        await post("/admin/products", { title: "Yeni", metadata: { sample: "travel@1" } }),
        await post(`/admin/products/${own}`, { metadata: { sample_of: own } }),
        await post(`/admin/products/${own}`, { metadata: { sample_at: "" } }),
        await post("/admin/products/batch", {
          update: [{ id: own, metadata: { sample: "travel@1", sample_of: own } }],
        }),
        await post("/admin/product-categories", {
          name: "Yeni",
          metadata: { sample_opened: "travel@1" },
        }),
      ]
      for (const answer of refused) {
        expect([answer.status, answer.data.message]).toEqual([
          400,
          "sample_catalog.metadata_reserved",
        ])
      }
      // The shop's own keys still save
      const ownKeys = await post(`/admin/products/${own}`, { metadata: { renk: "kırmızı" } })
      expect(ownKeys.status).toBe(200)
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
