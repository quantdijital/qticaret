import type { ICustomerModuleService } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { erasedEmail } from "../../src/lib/compliance/retention"
import { BUNDLE_FORMAT } from "../../src/lib/migration/sources/bundle"
import { bundle, fileOf } from "../fixtures/migration-bundle"
import { ASYNC_JOB_MODULE } from "../../src/modules/async-job"
import type AsyncJobModuleService from "../../src/modules/async-job/service"
import { MESSAGING_MODULE } from "../../src/modules/messaging"
import type MessagingModuleService from "../../src/modules/messaging/service"
import { MIGRATION_MODULE } from "../../src/modules/migration"
import type MigrationModuleService from "../../src/modules/migration/service"
import { PRODUCT_REVIEWS_MODULE } from "../../src/modules/product-reviews"
import type ProductReviewsModuleService from "../../src/modules/product-reviews/service"
import { eraseCustomer } from "../../src/workflows/legal/erasure/customer"
import { eraseTraces } from "../../src/workflows/legal/erasure/traces"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { sheetClient } from "../helpers/sheets"
import type { SheetJob } from "../helpers/sheets"
import { stockShop } from "../helpers/stock"

jest.setTimeout(600 * 1000)

type Counts = Record<string, Record<string, number>>

/** F14 (adr/0042): a shop moved in from its old platform, through the worker (KK2). */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let owner: Awaited<ReturnType<typeof createAdminUser>>
    const { settled } = sheetClient(http, getContainer, () => owner.headers)
    const migration = () => getContainer().resolve<MigrationModuleService>(MIGRATION_MODULE)

    const start = (body: Buffer, query: string, headers = owner.headers) =>
      settle(
        http.post<{ async_job: SheetJob }>(`/admin/migrations?${query}`, body, {
          headers: { ...headers, "content-type": "application/json" },
        })
      )
    const run = async (mode: "check" | "apply") => {
      const queued = await start(fileOf(bundle), `mode=${mode}`)
      expect(queued.status).toBe(202)
      const job = await settled(queued.data.async_job.id)
      expect(job.status).toBe("succeeded")
      return (job.result_summary as { counts: Counts }).counts
    }

    beforeEach(async () => {
      owner = await createAdminUser(http, getContainer())
      await stockShop(getContainer())
    })

    it("checks, applies and applies again without making anything twice (KK2)", async () => {
      const customers = getContainer().resolve<ICustomerModuleService>(Modules.CUSTOMER)
      await customers.createCustomers({ email: "zaten@example.com", first_name: "Zaten" })

      const checked = await run("check")
      expect(checked).toMatchObject({
        category: { read: 1, created: 2 },
        brand: { read: 1, created: 1 },
        product: { read: 2, created: 2, skipped: 0, failed: 0 },
        customer: { read: 3, created: 1, found: 1, skipped: 1 },
        consent: { created: 1 },
        order: { read: 2, created: 2 },
        review: { read: 3, created: 2, skipped: 1 },
        page: { read: 1 },
      })
      const query = getContainer().resolve(ContainerRegistrationKeys.QUERY)
      const productsOf = async () =>
        (
          await query.graph({
            entity: "product",
            fields: ["id", "handle", "status", "categories.handle", "weight", "length"],
            filters: { handle: ["tasinan-dokum-tava", "tasinan-kapak"] },
          })
        ).data as {
          id: string
          handle: string
          status: string
          categories: { handle: string }[]
          weight: number | null
          length: number | null
        }[]
      expect(await productsOf()).toHaveLength(0)

      const applied = await run("apply")
      expect(applied).toMatchObject({
        category: { created: 2 },
        product: { created: 2, failed: 0 },
        customer: { created: 1, found: 1, skipped: 1 },
        order: { created: 2 },
        review: { created: 2, skipped: 1 },
      })
      const products = await productsOf()
      const pan = products.find((product) => product.handle === "tasinan-dokum-tava")
      // A live product without measurements comes as a draft, never refused
      expect(products.find((product) => product.handle === "tasinan-kapak")?.status).toBe("draft")
      expect(pan).toMatchObject({ status: "published", categories: [{ handle: "tavalar" }] })

      const [ayse] = await customers.listCustomers({ email: "ayse.tasinan@example.com" })
      expect(ayse).toBeDefined()
      const consent = await getContainer()
        .resolve<MessagingModuleService>(MESSAGING_MODULE)
        .listMessageConsents({ customer_id: ayse?.id ?? "" })
      expect(consent).toMatchObject([{ channel: "email", status: "granted", source: "import" }])
      expect(new Date(consent[0]?.changed_at ?? 0).toISOString()).toBe("2025-03-01T07:00:00.000Z")

      const kept = await migration().listLegacyOrders({}, { order: { number: "ASC" } })
      expect(kept.map((order) => [order.number, order.customer_id])).toEqual([
        ["1001", ayse?.id],
        ["1002", null],
      ])

      const reviews = getContainer().resolve<ProductReviewsModuleService>(PRODUCT_REVIEWS_MODULE)
      const moved = await reviews.listProductReviews(
        { product_id: pan?.id ?? "" },
        { order: { created_at: "ASC" } }
      )
      expect(moved).toMatchObject([
        { rating: 2, status: "approved", origin: "migration", author_name: "Ayşe K." },
        { rating: 5, status: "pending", origin: "migration", author_name: "Müşteri" },
      ])
      expect(moved[0]?.customer_id).toBe(ayse?.id)
      expect(new Date(moved[0]?.created_at ?? 0).toISOString()).toBe("2025-05-10T06:00:00.000Z")
      const shown = await http.get<{
        rating: { average: number; count: number }
        reviews: { verified_purchase: boolean }[]
      }>(`/store/products/${pan?.id ?? ""}/reviews`, {
        headers: { "x-publishable-api-key": await publishableKey() },
      })
      expect(shown.data.rating).toEqual({ average: 2, count: 1 })
      expect(shown.data.reviews).toMatchObject([{ verified_purchase: false }])

      const again = await run("apply")
      expect(again).toMatchObject({
        category: { created: 0, found: 2 },
        brand: { created: 0, found: 1 },
        product: { created: 0, failed: 0 },
        customer: { created: 0, found: 2 },
        consent: { created: 0 },
        order: { created: 0, found: 2 },
        review: { created: 0, found: 2 },
      })
      expect(await productsOf()).toHaveLength(2)
      expect(await migration().listLegacyOrders({})).toHaveLength(2)
      expect(await reviews.listProductReviews({ product_id: pan?.id ?? "" })).toHaveLength(2)
      const { data: pans } = await query.graph({
        entity: "product_category",
        fields: ["id"],
        filters: { name: "Tavalar" },
      })
      expect(pans).toHaveLength(1)

      // An erasure reaches the old orders: by the account, and by a guest's e-mail there
      await eraseTraces(getContainer(), ayse?.id ?? "", ["misafir@example.com"])
      const erased = await migration().listLegacyOrders({})
      expect(erased.map((order) => order.email)).toEqual([
        erasedEmail(ayse?.id ?? ""),
        erasedEmail(ayse?.id ?? ""),
      ])
      // Erased whole, then the migration run again: she stays erased, her key no longer kept
      await eraseCustomer(getContainer(), ayse?.id ?? "")
      const after = await run("apply")
      expect(after).toMatchObject({ customer: { created: 0, skipped: 2 }, consent: { created: 0 } })
      expect(await customers.listCustomers({ email: "ayse.tasinan@example.com" })).toHaveLength(0)
      const items = await migration().listMigrationItems({ kind: "customer" })
      expect(items.some((item) => item.source_key === "cus-1")).toBe(false)
    })

    it("never writes over a product: one moved stays as the shop keeps it, another's handle is left", async () => {
      const catalog = getContainer().resolve(Modules.PRODUCT)
      const [own] = await catalog.createProducts([
        { title: "Elle eklenen kapak", handle: "tasinan-kapak", status: "draft" },
      ])
      const first = await run("apply")
      expect(first).toMatchObject({ product: { read: 2, created: 1, skipped: 1 } })
      const [pan] = await catalog.listProducts({ handle: "tasinan-dokum-tava" })
      await catalog.updateProducts(pan?.id ?? "", { title: "Burada değişti" })

      const again = await run("apply")
      expect(again).toMatchObject({ product: { created: 0, found: 1, skipped: 1 } })
      const [kept] = await catalog.listProducts({ id: pan?.id ?? "" })
      expect(kept?.title).toBe("Burada değişti")
      const [mine] = await catalog.listProducts({ id: own?.id ?? "" })
      expect(mine?.title).toBe("Elle eklenen kapak")
    })

    it("is the owner's, asks them again to apply, and keeps no file it read", async () => {
      const admin = await createAdminUser(http, getContainer(), "admin")
      expect((await start(fileOf(bundle), "mode=check", admin.headers)).status).toBe(403)
      expect((await settle(http.get("/admin/migrations", { headers: admin.headers }))).status).toBe(
        403
      )
      expect((await start(fileOf(bundle), "mode=apply", owner.plain)).status).toBe(428)
      expect((await start(Buffer.from("[]"), "mode=check")).status).toBe(400)
      expect((await start(fileOf(bundle), "mode=check&weight=500")).status).toBe(400)

      const broken = await start(fileOf({ format: BUNDLE_FORMAT, version: 2 }), "mode=check")
      expect(broken.status).toBe(202)
      const job = await settled(broken.data.async_job.id)
      expect(job.status).toBe("failed")
      const [record] = await migration().listMigrationRuns({ job_id: job.id })
      expect(record?.status).toBe("failed")
      // The file holds customers: gone however the run ended
      const [stored] = await getContainer()
        .resolve<AsyncJobModuleService>(ASYNC_JOB_MODULE)
        .listAsyncJobs({ id: job.id }, { select: ["input"] })
      const fileId = (stored?.input as { source_file_id: string }).source_file_id
      await expect(getContainer().resolve(Modules.FILE).getAsBuffer(fileId)).rejects.toThrow()

      const listed = await http.get<{ runs: { status: string; mode: string }[] }>(
        "/admin/migrations",
        { headers: owner.headers }
      )
      expect(listed.data.runs).toMatchObject([{ status: "failed", mode: "check" }])
    })

    async function publishableKey(): Promise<string> {
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({ entity: "api_key", fields: ["token"], filters: { type: "publishable" } })
      return (data[0] as { token: string }).token
    }
  },
})
