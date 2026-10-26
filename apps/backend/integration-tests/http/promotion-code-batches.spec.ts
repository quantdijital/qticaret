import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { placeOrder } from "../../src/scripts/seed/orders/place"
import { removeCodeBatchOf } from "../../src/workflows/promotions/code-batches"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { sheetClient } from "../helpers/sheets"
import type { SheetJob } from "../helpers/sheets"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"

jest.setTimeout(300 * 1000)

const CODE = /^YAZ-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{12}$/

/** F4.6 (ADR-0024): batches of single-use codes, kept out of the list, each code used once. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }
    let shop: StockShop
    let variantId: string
    const sheets = sheetClient(http, getContainer, () => admin.headers)
    const get = <T>(url: string) => settle(http.get<T>(url, { headers: admin.headers }))

    beforeEach(async () => {
      admin = await createAdminUser(http, getContainer())
      shop = await stockShop(getContainer())
      variantId = (await stockedProduct(getContainer(), shop, "kod-urun", 50, 100)).variantId
    })

    async function template(extra: Record<string, unknown> = {}): Promise<string> {
      const made = await settle(
        http.post<{ promotion: { id: string } }>(
          "/admin/promotions",
          {
            code: "yaz",
            type: "standard",
            is_automatic: false,
            is_tax_inclusive: true,
            status: "active",
            application_method: {
              type: "percentage",
              target_type: "order",
              allocation: "across",
              value: 10,
            },
            ...extra,
          },
          { headers: admin.headers }
        )
      )
      expect(made.status).toBe(200)
      return made.data.promotion.id
    }

    async function codes(promotionId: string, count: number): Promise<SheetJob> {
      const queued = await settle(
        http.post<{ async_job: SheetJob }>(
          "/admin/async-jobs",
          { type: "promotion.codes", input: { promotion_id: promotionId, count } },
          { headers: admin.headers }
        )
      )
      expect(queued.status).toBe(202)
      return sheets.settled(queued.data.async_job.id)
    }

    const order = (code: string) =>
      placeOrder(getContainer(), {
        ...shop,
        items: [{ variant_id: variantId, quantity: 1 }],
        promo_codes: [code],
        address: { first_name: "Ayşe", last_name: "Yılmaz", address_1: "Demo Sokak 1" },
      })

    it("makes a batch of codes from a promotion, kept out of its list, each usable once", async () => {
      const id = await template()
      const job = await codes(id, 25)
      expect(job).toMatchObject({ status: "succeeded", result_summary: { created: 25 } })
      const made = (await sheets.fileBytes(job)).toString("utf8").trim().split(/\r\n/u)
      expect(made[0]).toBe("kod")
      const list = made.slice(1)
      expect(list).toHaveLength(25)
      expect(new Set(list).size).toBe(25)
      list.forEach((code) => {
        expect(code).toMatch(CODE)
      })

      // The list shows the template, not its 25 copies, and that it has a batch
      const board = await get<{
        promotions: { id: string }[]
        batch_counts: Record<string, number>
      }>("/admin/promotion-board")
      expect(board.data.promotions.map((promotion) => promotion.id)).toEqual([id])
      expect(board.data.batch_counts).toEqual({ [id]: 1 })

      const first = list[0] ?? ""
      await order(first)
      // Used once: Medusa no longer applies it, and the second order pays in full
      const second = await order(first)
      const { data: orders } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({ entity: "order", fields: ["discount_total"], filters: { id: second } })
      expect(Number((orders[0] as { discount_total: unknown }).discount_total)).toBe(0)

      const batches = await get<{
        batches: { campaign_id: string; count: number; used: number }[]
      }>(`/admin/promotions/${id}/code-batches`)
      expect(batches.data.batches).toMatchObject([{ count: 25, used: 1 }])
      const csv = await get<string>(
        `/admin/promotions/${id}/code-batches/${batches.data.batches[0]?.campaign_id ?? ""}/codes`
      )
      expect(csv.headers["content-type"]).toContain("text/csv")
      expect(csv.data).toContain(`${first};evet`)
      expect(csv.data.match(/;hayır/gu)).toHaveLength(24)
    })

    it("refuses an automatic promotion as a template, and more than 10,000 codes", async () => {
      const automatic = await template({ is_automatic: true, code: "OTOMATIK" })
      const failed = await codes(automatic, 5)
      expect(failed).toMatchObject({ status: "failed", error_code: "promotions.codes_template" })
      const board = await get<{ batch_counts: Record<string, number> }>("/admin/promotion-board")
      expect(board.data.batch_counts).toEqual({})

      const tooMany = await settle(
        http.post(
          "/admin/async-jobs",
          { type: "promotion.codes", input: { promotion_id: automatic, count: 10_001 } },
          { headers: admin.headers }
        )
      )
      expect(tooMany.status).toBe(400)
    })

    it("does not give a batch's codes under another promotion", async () => {
      const id = await template()
      await codes(id, 2)
      const other = await template({ code: "KIS" })
      const [batch] = (
        await get<{ batches: { campaign_id: string }[] }>(`/admin/promotions/${id}/code-batches`)
      ).data.batches
      const wrong = await get(
        `/admin/promotions/${other}/code-batches/${batch?.campaign_id ?? ""}/codes`
      )
      expect(wrong.status).toBe(404)
    })

    it("gives a batch its template's budget, and takes a batch back whole", async () => {
      const campaign = await http.post<{ campaign: { id: string } }>(
        "/admin/campaigns",
        {
          name: "Kişi başı bir",
          campaign_identifier: "kisi-basi",
          budget: { type: "use_by_attribute", attribute: "customer_id", limit: 1 },
        },
        { headers: admin.headers }
      )
      const id = await template({ campaign_id: campaign.data.campaign.id })
      const job = await codes(id, 3)
      expect(job.status).toBe("succeeded")
      const batchId = job.result_summary?.["campaign_id"]
      if (typeof batchId !== "string") {
        throw new Error("the job names no batch campaign")
      }
      const query = getContainer().resolve(ContainerRegistrationKeys.QUERY)
      const { data } = await query.graph({
        entity: "campaign",
        fields: ["budget.type", "budget.limit", "budget.attribute"],
        filters: { id: batchId },
      })
      expect(data[0]).toMatchObject({
        budget: { type: "use_by_attribute", limit: 1, attribute: "customer_id" },
      })

      await removeCodeBatchOf(getContainer(), batchId)
      const left = await query.graph({
        entity: "promotion",
        fields: ["id"],
        filters: { campaign_id: batchId },
      })
      expect(left.data).toEqual([])
      const gone = await query.graph({
        entity: "campaign",
        fields: ["id"],
        filters: { id: batchId },
      })
      expect(gone.data).toEqual([])
    })
  },
})
