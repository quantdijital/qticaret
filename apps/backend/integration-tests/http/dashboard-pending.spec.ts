import { randomUUID } from "node:crypto"
import { Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { clearPendingCounts } from "../../src/api/admin/dashboard/pending/read"
import { CONTACT_MESSAGES_MODULE } from "../../src/modules/contact-messages"
import type ContactMessagesModuleService from "../../src/modules/contact-messages/service"
import { PRODUCT_QA_MODULE } from "../../src/modules/product-qa"
import type ProductQaModuleService from "../../src/modules/product-qa/service"
import { PRODUCT_REVIEWS_MODULE } from "../../src/modules/product-reviews"
import type ProductReviewsModuleService from "../../src/modules/product-reviews/service"
import { RETURN_REQUESTS_MODULE } from "../../src/modules/return-requests"
import type ReturnRequestsModuleService from "../../src/modules/return-requests/service"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"

jest.setTimeout(120 * 1000)

const KEYS = [
  "pending_reviews",
  "pending_questions",
  "open_returns",
  "unread_contact",
  "out_of_stock",
] as const

type Pending = Record<(typeof KEYS)[number], number | null>

/** The menu's badges and the dashboard's waiting work (docs/06): counts only, people only. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    const get = (headers: Record<string, string> = {}) =>
      settle(http.get<Pending>("/admin/dashboard/pending", { headers }))

    beforeEach(() => {
      clearPendingCounts()
    })

    it("answers zeros for a shop with nothing waiting, and nothing without a session", async () => {
      const owner = await createAdminUser(http, getContainer())
      const answer = await get(owner.headers)

      expect(answer.status).toBe(200)
      expect(answer.data).toEqual(Object.fromEntries(KEYS.map((key) => [key, 0])))
      expect((await get()).status).toBe(401)
    })

    it("counts what waits in each list, the decided ones left out, for every role", async () => {
      const container = getContainer()
      const reviews = container.resolve<ProductReviewsModuleService>(PRODUCT_REVIEWS_MODULE)
      const qa = container.resolve<ProductQaModuleService>(PRODUCT_QA_MODULE)
      const returns = container.resolve<ReturnRequestsModuleService>(RETURN_REQUESTS_MODULE)
      const contact = container.resolve<ContactMessagesModuleService>(CONTACT_MESSAGES_MODULE)
      const review = (status: "pending" | "approved") => ({
        product_id: "prod_pending_counts",
        customer_id: `cus_${randomUUID()}`,
        order_id: `order_${randomUUID()}`,
        rating: 4,
        title: "Güzel",
        body: "Beklediğim gibi geldi.",
        author_name: "Ayşe Y.",
        status,
      })
      await reviews.createProductReviews([review("pending"), review("pending"), review("approved")])
      const [, answered] = await qa.createProductQuestions([
        {
          product_id: "prod_pending_counts",
          customer_id: null,
          author_name: "Mehmet K.",
          body: "Kutusu var mı?",
        },
        {
          product_id: "prod_pending_counts",
          customer_id: null,
          author_name: "Elif D.",
          body: "Hediye paketi olur mu?",
          status: "approved",
        },
      ])
      // An approved question whose new answer waits counts as waiting, as in the list
      await qa.createProductAnswers([
        {
          question_id: answered?.id ?? "",
          product_id: "prod_pending_counts",
          author_kind: "customer",
          customer_id: null,
          author_name: "Can T.",
          body: "Oluyor.",
        },
      ])
      const request = (status: "requested" | "rejected") => ({
        order_id: `order_${randomUUID()}`,
        customer_id: null,
        reason: "damaged" as const,
        note: null,
        status,
        items: [{ line_item_id: "ordli_1", quantity: 1 }] as unknown as Record<string, unknown>,
      })
      await returns.createReturnRequests([request("requested"), request("rejected")])
      await contact.createContactMessages([
        { subject: "order", sealed: "sealed", status: "new" },
        { subject: "product", sealed: "sealed", status: "handled" },
      ])
      // A stock record with nothing on any shelf: sold out
      await container
        .resolve(Modules.INVENTORY)
        .createInventoryItems([{ sku: `PENDING-${randomUUID()}` }])

      const expected = {
        pending_reviews: 2,
        pending_questions: 2,
        open_returns: 1,
        unread_contact: 1,
        out_of_stock: 1,
      }
      for (const role of ["owner", "admin", "operations", "readonly"] as const) {
        clearPendingCounts()
        const staff = await createAdminUser(http, container, role)
        const answer = await get(staff.headers)
        expect(answer.status).toBe(200)
        // Every role reads these lists today (adr/0040): each gets every number
        expect(answer.data).toEqual(expected)
      }
    })
  },
})
