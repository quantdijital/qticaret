import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { AUDIT_LOG_MODULE } from "../../src/modules/audit-log"
import type AuditLogModuleService from "../../src/modules/audit-log/service"
import { PRODUCT_REVIEWS_MODULE } from "../../src/modules/product-reviews"
import type ProductReviewsModuleService from "../../src/modules/product-reviews/service"
import { createAdminUser } from "../helpers/admin"
import { eventually } from "../helpers/eventually"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { createStorefront, createTestProduct } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"

jest.setTimeout(180 * 1000)

interface Reply {
  body: string
  author_name: string
  created_at: string
}

interface AdminRow {
  id: string
  status: string
  reply: string | null
  replied_at: string | null
}

/**
 * The shop's public reply under a product review, from the panel: on an
 * approved review only, changed and removed, audited without its words,
 * by the roles that answer questions; the storefront shows it under the
 * review, signed with the shop's name.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }
    let storefront: Storefront
    let productId: string
    let approvedId: string
    let pendingId: string

    const reply = (id: string, body: Record<string, unknown>, headers = admin.headers) =>
      settle(
        http.post<{ reply?: { reply: string | null }; message?: string }>(
          `/admin/product-reviews/${id}/reply`,
          body,
          { headers }
        )
      )
    const unreply = (id: string, headers = admin.headers) =>
      settle(http.delete<{ message?: string }>(`/admin/product-reviews/${id}/reply`, { headers }))
    const adminRows = async (query: string) =>
      (
        await http.get<{ reviews: AdminRow[]; count: number }>(`/admin/product-reviews?${query}`, {
          headers: admin.headers,
        })
      ).data
    const productReplies = async () =>
      (
        await http.get<{ reviews: { id: string; reply: Reply | null }[] }>(
          `/store/products/${productId}/reviews`,
          { headers: storefront.headers }
        )
      ).data.reviews
    const shopReplies = async () =>
      (
        await http.get<{ reviews: { id: string; reply: Reply | null }[] }>("/store/reviews", {
          headers: storefront.headers,
        })
      ).data.reviews

    beforeEach(async () => {
      const container = getContainer()
      admin = await createAdminUser(http, container)
      storefront = await createStorefront(container)
      const [store] = await container.resolve(Modules.STORE).listStores({}, { take: 1 })
      if (store) {
        await container.resolve(Modules.STORE).updateStores(store.id, { name: "Atölye Bıçak" })
      }
      const handle = `bicak-${String(Date.now())}`
      await createTestProduct(container, storefront.salesChannelId, { handle, price: 250 })
      const { data } = await container
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({ entity: "product", fields: ["id"], filters: { handle } })
      productId = (data[0] as { id: string }).id
      const reviews = container.resolve<ProductReviewsModuleService>(PRODUCT_REVIEWS_MODULE)
      const base = {
        product_id: productId,
        order_id: null,
        rating: 4,
        title: null,
        author_name: "Ayşe Y.",
        has_link: false,
      }
      const [approved, pending] = await reviews.createProductReviews([
        { ...base, customer_id: "cus_1", body: "Çok keskin, sapı rahat.", status: "approved" },
        { ...base, customer_id: "cus_2", body: "Kutusu ezik geldi.", status: "pending" },
      ])
      approvedId = approved?.id ?? ""
      pendingId = pending?.id ?? ""
    })

    it("writes, changes and removes the reply; the storefront shows it under the review", async () => {
      expect((await adminRows("status=approved&replied=false")).reviews.map((r) => r.id)).toEqual([
        approvedId,
      ])

      const first = await reply(approvedId, { body: "  Teşekkür ederiz,\niyi günlerde!  " })
      expect(first.status).toBe(200)
      expect(first.data.reply?.reply).toBe("Teşekkür ederiz,\niyi günlerde!")

      const [row] = (await adminRows("status=approved")).reviews
      expect(row).toMatchObject({ id: approvedId, reply: "Teşekkür ederiz,\niyi günlerde!" })
      expect(row?.replied_at).not.toBeNull()
      expect((await adminRows("status=approved&replied=false")).count).toBe(0)
      expect((await adminRows("status=approved&replied=true")).count).toBe(1)

      const [shown] = await productReplies()
      expect(shown?.reply).toEqual({
        body: "Teşekkür ederiz,\niyi günlerde!",
        author_name: "Atölye Bıçak",
        created_at: expect.any(String) as string,
      })
      expect((await shopReplies()).find((each) => each.id === approvedId)?.reply?.body).toBe(
        "Teşekkür ederiz,\niyi günlerde!"
      )

      expect((await reply(approvedId, { body: "Güncel yanıt." })).status).toBe(200)
      expect((await productReplies())[0]?.reply?.body).toBe("Güncel yanıt.")

      expect((await unreply(approvedId)).status).toBe(200)
      expect((await productReplies())[0]?.reply).toBeNull()
      const again = await unreply(approvedId)
      expect(again.status).toBe(400)
      expect(again.data.message).toBe("reviews.reply_missing")

      // Whether, how long, who and when: never the words
      const entries = await eventually(
        async () =>
          (
            await getContainer()
              .resolve<AuditLogModuleService>(AUDIT_LOG_MODULE)
              .listAuditEntries(
                { resource_type: "product_review", resource_id: approvedId },
                { order: { created_at: "ASC" } }
              )
          ).filter((entry) => entry.outcome === 200),
        (found) => found.length >= 3
      )
      expect(entries.map((entry) => entry.action)).toEqual([
        "POST /admin/product-reviews/:id/reply",
        "POST /admin/product-reviews/:id/reply",
        "DELETE /admin/product-reviews/:id/reply",
      ])
      expect(entries[0]?.changes).toMatchObject({
        diff: {
          replied: { before: false, after: true },
          reply_length: { before: 0, after: 30 },
        },
      })
      expect(JSON.stringify(entries)).not.toContain("Teşekkür")
    })

    it("refuses a reply to a waiting review, an empty or over-long one, and a stray field", async () => {
      const waiting = await reply(pendingId, { body: "Teşekkürler" })
      expect(waiting.status).toBe(400)
      expect(waiting.data.message).toBe("reviews.reply_not_approved")

      const empty = await reply(approvedId, { body: "   " })
      expect(empty.status).toBe(400)
      expect(empty.data.message).toContain("reviews.reply_required")
      const long = await reply(approvedId, { body: "a".repeat(1001) })
      expect(long.status).toBe(400)
      expect(long.data.message).toContain("reviews.reply_too_long")
      expect((await reply(approvedId, { body: "Tamam", status: "approved" })).status).toBe(400)
      expect((await reply("prev_yok", { body: "Teşekkürler" })).status).toBe(404)
      expect((await productReplies())[0]?.reply).toBeNull()
    })

    it("lets operations reply as they answer questions; read-only staff may not", async () => {
      const operations = await createAdminUser(http, getContainer(), "operations")
      expect((await reply(approvedId, { body: "Teşekkürler" }, operations.headers)).status).toBe(
        200
      )

      const readonly = await createAdminUser(http, getContainer(), "readonly")
      expect((await reply(approvedId, { body: "Değişti" }, readonly.headers)).status).toBe(403)
      expect((await unreply(approvedId, readonly.headers)).status).toBe(403)
      expect((await productReplies())[0]?.reply?.body).toBe("Teşekkürler")
    })
  },
})
