import { Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import productPublishSchedule from "../../src/jobs/product-publish-schedule"
import { PUBLISH_AT } from "../../src/lib/catalog/publish-schedule"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"

jest.setTimeout(120 * 1000)

interface Product {
  id: string
  status: string
  metadata: Record<string, unknown> | null
}

interface Schedule {
  publish_at: string | null
  failed: { at: string; reason: string } | null
}

const HOUR = 60 * 60 * 1000

const product = (title: string, status = "draft") => ({
  title,
  status,
  options: [{ title: "Boyut", values: ["20 cm"] }],
  variants: [
    {
      title: "20 cm",
      options: { Boyut: "20 cm" },
      manage_inventory: false,
      prices: [{ currency_code: "try", amount: 1000 }],
    },
  ],
})

/** S2: a draft's planned publish, set and cancelled from the product page, published by the job. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }

    const post = <T>(url: string, body: unknown) =>
      settle(http.post<T & { message?: string }>(url, body, { headers: admin.headers }))
    const create = async (title: string, status = "draft") =>
      (await post<{ product: Product }>("/admin/products", product(title, status))).data.product
    const read = async (id: string) =>
      (
        await http.get<{ product: Product }>(
          `/admin/products/${id}?fields=id,status,metadata`,
          admin
        )
      ).data.product
    const schedule = (id: string, publishAt: string | null) =>
      post<{ schedule: Schedule }>(`/admin/products/${id}/publish-schedule`, {
        publish_at: publishAt,
      })

    beforeEach(async () => {
      admin = await createAdminUser(http, getContainer())
    })

    it("plans a draft's publish in UTC and cancels it", async () => {
      const draft = await create("Planlı Bıçak")
      const at = new Date(Date.now() + 2 * HOUR)
      // Typed as Istanbul's wall clock; stored as UTC
      const local = new Date(at.getTime() + 3 * HOUR).toISOString().replace("Z", "+03:00")

      const set = await schedule(draft.id, local)
      expect(set.status).toBe(200)
      expect(set.data.schedule.publish_at).toBe(new Date(at.getTime()).toISOString())
      expect((await read(draft.id)).metadata?.[PUBLISH_AT]).toBe(set.data.schedule.publish_at)

      const cancelled = await settle(
        http.delete<{ schedule: Schedule }>(`/admin/products/${draft.id}/publish-schedule`, admin)
      )
      expect(cancelled.status).toBe(200)
      expect(cancelled.data.schedule.publish_at).toBeNull()
      const after = await read(draft.id)
      expect(after.status).toBe("draft")
      expect(after.metadata?.[PUBLISH_AT]).toBeUndefined()
    })

    it("refuses a past moment, a live product, a moment without offset and extra fields", async () => {
      const draft = await create("Geçmiş")
      const live = await create("Yayında", "published")
      const future = new Date(Date.now() + HOUR).toISOString()

      const past = await schedule(draft.id, new Date(Date.now() - HOUR).toISOString())
      const tooFar = await schedule(draft.id, new Date(Date.now() + 400 * 24 * HOUR).toISOString())
      const published = await schedule(live.id, future)
      const noOffset = await schedule(draft.id, "2027-01-01T10:00:00")
      const extra = await post(`/admin/products/${draft.id}/publish-schedule`, {
        publish_at: future,
        status: "published",
      })

      expect([past.status, past.data.message]).toEqual([400, "publish_schedule.past"])
      expect([tooFar.status, tooFar.data.message]).toEqual([400, "publish_schedule.too_far"])
      expect([published.status, published.data.message]).toEqual([
        400,
        "publish_schedule.not_draft",
      ])
      expect(noOffset.status).toBe(400)
      expect(extra.status).toBe(400)
      expect((await read(draft.id)).status).toBe("draft")
    })

    it("publishes a due draft through the job and leaves one not yet due", async () => {
      const due = await create("Vakti Gelen")
      const waiting = await create("Bekleyen")
      expect((await schedule(waiting.id, new Date(Date.now() + HOUR).toISOString())).status).toBe(
        200
      )
      // A moment already passed, as the job finds it a minute later
      await getContainer()
        .resolve(Modules.PRODUCT)
        .updateProducts(due.id, {
          metadata: { [PUBLISH_AT]: new Date(Date.now() - 60_000).toISOString() },
        })

      await productPublishSchedule(getContainer())

      const published = await read(due.id)
      expect(published.status).toBe("published")
      expect(published.metadata?.[PUBLISH_AT]).toBeUndefined()
      expect((await read(waiting.id)).status).toBe("draft")
    })

    it("drops a plan when the product is published by hand", async () => {
      const draft = await create("Elle Yayınlanan")
      await schedule(draft.id, new Date(Date.now() + HOUR).toISOString())

      const published = await post(`/admin/products/${draft.id}`, { status: "published" })
      expect(published.status).toBe(200)
      expect((await read(draft.id)).metadata?.[PUBLISH_AT]).toBeUndefined()

      // Taken back to draft, nothing publishes it again
      await post(`/admin/products/${draft.id}`, { status: "draft" })
      await productPublishSchedule(getContainer())
      expect((await read(draft.id)).status).toBe("draft")
    })
  },
})
