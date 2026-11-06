import { readFileSync, rmSync } from "node:fs"
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { turkishDay } from "../../src/lib/dashboard"
import { CSV_BOM } from "../../src/lib/security"
import { AUDIT_LOG_MODULE } from "../../src/modules/audit-log"
import type AuditLogModuleService from "../../src/modules/audit-log/service"
import { EINVOICE_MODULE } from "../../src/modules/einvoice"
import type EinvoiceModuleService from "../../src/modules/einvoice/service"
import { ORDER_NOTES_MODULE } from "../../src/modules/order-notes"
import type OrderNotesModuleService from "../../src/modules/order-notes/service"
import { seedDemo } from "../../src/scripts/seed"
import { DEMO_SHIPPING_OPTIONS } from "../../src/scripts/seed/data"
import { advanceOrder } from "../../src/scripts/seed/orders/advance"
import type { DemoStage } from "../../src/scripts/seed/orders/advance"
import { placeOrder } from "../../src/scripts/seed/orders/place"
import { createAdminUser } from "../helpers/admin"
import { filesNamed } from "../helpers/files"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(240 * 1000)

interface Board {
  orders: { id: string; addons: { lines: number; non_withdrawable: boolean } }[]
  count: number
}

interface Slips {
  shop: { name: string | null }
  prices: boolean
  orders: {
    id: string
    payment_method: string
    notes: string[]
    totals: Record<string, string> | null
    items: {
      title: string
      quantity: number
      unit_price: string | null
      addons: { label: string; value: string }[]
      non_withdrawable: boolean
    }[]
  }[]
}

interface Job {
  id: string
  status: string
  result_summary: Record<string, unknown> | null
}

const ENGRAVING = {
  qt_addons: {
    items: [
      {
        addon_id: "addon_1",
        kind: "text",
        label: "Ürün üzerine yazı",
        value: "Ahmet & Ayşe 2026",
        amount: 35,
        non_withdrawable: true,
      },
    ],
    base: 100,
    non_withdrawable: true,
    max_quantity: 10,
  },
}

async function firstId(container: MedusaContainer, entity: string, filters = {}) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity, fields: ["id"], filters })
  return (data[0] as { id: string } | undefined)?.id ?? ""
}

/**
 * The order desk: the list's filters by day, method and carrier, its
 * add-on badge, packing slips and the pick list, the owner's export, and
 * the stopped invoices tried again at once.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let owner: { headers: Record<string, string> }

    const get = <T = Board>(url: string, headers = owner.headers) =>
      settle(http.get<T>(url, { headers }))
    const post = <T>(url: string, body: unknown, headers = owner.headers) =>
      settle(http.post<T>(url, body, { headers }))

    const shop = async () => {
      const container = getContainer()
      const { regionId, salesChannelId } = await seedDemo(container)
      const option = await firstId(container, "shipping_option", {
        name: DEMO_SHIPPING_OPTIONS[0].name,
      })
      const variant = await firstId(container, "product_variant")
      return async (stage: DemoStage, lastName: string) => {
        const orderId = await placeOrder(container, {
          regionId,
          salesChannelId,
          shippingOptionId: option,
          items: [{ variant_id: variant, quantity: 2 }],
          address: {
            first_name: "Ayşe",
            last_name: lastName,
            address_1: "Demo Sokak 1",
            province: "İstanbul",
            city: "Kadıköy",
          },
        })
        await advanceOrder(container, orderId, stage)
        return orderId
      }
    }
    const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
    const lineOf = async (orderId: string) => {
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({
          entity: "order",
          fields: ["items.id", "items.metadata"],
          filters: { id: orderId },
        })
      return (data[0] as { items: { id: string; metadata?: Record<string, unknown> | null }[] })
        .items[0]
    }
    /**
     * The line given add-ons as the storefront's checkout would have; the
     * order's own subscribers (a paid order's gift card step) write its
     * metadata back after placing, so it is written until it stays.
     */
    const engrave = async (orderId: string) => {
      for (let attempt = 0; attempt < 10; attempt++) {
        const line = await lineOf(orderId)
        await getContainer()
          .resolve(Modules.ORDER)
          .updateOrderLineItems(line?.id ?? "", { metadata: ENGRAVING })
        await pause(500)
        if ((await lineOf(orderId))?.metadata?.["qt_addons"]) {
          return
        }
      }
      throw new Error("the line's add-ons did not stay")
    }
    const settled = async (id: string): Promise<Job> => {
      for (let attempt = 0; attempt < 100; attempt++) {
        const { data } = await http.get<{ async_job: Job }>(`/admin/async-jobs/${id}`, {
          headers: owner.headers,
        })
        if (data.async_job.status !== "queued" && data.async_job.status !== "running") {
          return data.async_job
        }
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
      throw new Error("job did not finish")
    }

    beforeEach(async () => {
      await loadTrAddressFixture(getContainer())
      owner = await createAdminUser(http, getContainer())
    })

    afterAll(() => {
      for (const path of filesNamed(/siparisler-.*\.(csv|xlsx)$/)) {
        rmSync(path, { force: true })
      }
    })

    it("filters by the days placed, the method and the carrier, and badges lines with add-ons", async () => {
      const place = await shop()
      const engraved = await place("to_ship", "Yılmaz")
      const plain = await place("to_ship", "Demir")
      await engrave(engraved)
      const linked = await place("to_ship", "Kaya")
      await getContainer()
        .resolve(Modules.ORDER)
        .updateOrders(linked, { metadata: { qt_payment_link: "plink_1" } })
      const today = turkishDay(new Date())
      const yesterday = turkishDay(new Date(Date.now() - 86_400_000))

      const all = await get("/admin/order-board?stage=to_ship")
      const fromToday = await get(`/admin/order-board?from=${today}&to=${today}`)
      const before = await get(`/admin/order-board?to=${yesterday}`)
      const backwards = await get(`/admin/order-board?from=${today}&to=${yesterday}`)
      const noDay = await get("/admin/order-board?from=2026-02-30")
      const byLink = await get("/admin/order-board?method=payment_link")
      const byCard = await get("/admin/order-board?method=card")
      const own = await get("/admin/order-board?carrier=own")
      const aras = await get("/admin/order-board?carrier=aras")
      const unknown = await get("/admin/order-board?carrier=mng")

      const addonsOf = (id: string) => all.data.orders.find((order) => order.id === id)?.addons
      expect(addonsOf(engraved)).toEqual({ lines: 1, non_withdrawable: true })
      expect(addonsOf(plain)).toEqual({ lines: 0, non_withdrawable: false })
      expect(fromToday.data.count).toBe(3)
      expect(before.data.count).toBe(0)
      expect(backwards.status).toBe(400)
      expect(noDay.status).toBe(400)
      expect(byLink.data.orders.map((order) => order.id)).toEqual([linked])
      // The demo pays with the system's provider: no card
      expect(byCard.data.count).toBe(0)
      // The demo's options are the shop's own delivery
      expect(own.data.count).toBe(3)
      expect(aras.data.count).toBe(0)
      expect(unknown.status).toBe(400)
    })

    it("prints packing slips with the add-ons' full text, prices only when the shop asks", async () => {
      const place = await shop()
      const first = await place("to_ship", "Yılmaz")
      const second = await place("to_ship", "Demir")
      await engrave(first)
      await getContainer()
        .resolve<OrderNotesModuleService>(ORDER_NOTES_MODULE)
        .createOrderNotes({ order_id: first, author_id: "user_1", body: "Hediye paketi yapılacak" })
      const readonly = await createAdminUser(http, getContainer(), "readonly")

      const slips = await get<Slips>(`/admin/packing-slips?ids=${second},${first},order_NONE00001`)
      const byReadonly = await get<Slips>(`/admin/packing-slips?ids=${first}`, readonly.headers)
      const tooMany = await get(
        `/admin/packing-slips?ids=${Array.from({ length: 51 }, (_, n) => `order_${String(n)}`).join(",")}`
      )
      const bad = await get("/admin/packing-slips?ids=cus_1")
      const anonymous = await settle(http.get(`/admin/packing-slips?ids=${first}`))
      await post("/admin/platform-settings/shipping", { packing_slip_prices: true })
      const priced = await get<Slips>(`/admin/packing-slips?ids=${first}`)

      expect(slips.status).toBe(200)
      expect(slips.data.prices).toBe(false)
      expect(slips.data.orders.map((order) => order.id)).toEqual([second, first])
      const slip = slips.data.orders[1]
      expect(slip?.notes).toEqual(["Hediye paketi yapılacak"])
      expect(slip?.totals).toBeNull()
      expect(slip?.items[0]).toMatchObject({
        quantity: 2,
        unit_price: null,
        non_withdrawable: true,
        addons: [{ label: "Ürün üzerine yazı", value: "Ahmet & Ayşe 2026" }],
      })
      expect(byReadonly.status).toBe(200)
      expect(tooMany.status).toBe(400)
      expect(bad.status).toBe(400)
      expect(anonymous.status).toBe(401)
      expect(priced.data.prices).toBe(true)
      expect(priced.data.orders[0]?.totals).toMatchObject({ total: expect.any(String) as unknown })
      expect(priced.data.orders[0]?.items[0]?.unit_price).toEqual(expect.any(String))
    })

    it("exports the filtered list for the owner alone, a row per line, and records it", async () => {
      const place = await shop()
      const engraved = await place("to_ship", "Yılmaz")
      await place("delivered", "Demir")
      await engrave(engraved)
      const admin = await createAdminUser(http, getContainer(), "admin")

      const byAdmin = await post("/admin/order-board/export", { stage: "to_ship" }, admin.headers)
      const throughJobs = await post("/admin/async-jobs", {
        type: "order.export",
        input: { stage: "to_ship" },
      })
      const badFilter = await post("/admin/order-board/export", { stage: "lost" })
      const queued = await post<{ async_job: Job }>("/admin/order-board/export", {
        stage: "to_ship",
        format: "csv",
      })
      const job = await settled(queued.data.async_job.id)
      const seenByAdmin = await get(`/admin/async-jobs/${job.id}`, admin.headers)
      const result = await get<{ url: string }>(`/admin/async-jobs/${job.id}/result`)
      const path = filesNamed(/siparisler-.*\.csv$/).find((file) =>
        result.data.url.endsWith(file.split("/").pop() ?? "")
      )
      const text = readFileSync(path ?? "", "utf8")
      const audit = await getContainer()
        .resolve<AuditLogModuleService>(AUDIT_LOG_MODULE)
        .listAuditEntries({ action: "order.export_made" })

      expect(byAdmin.status).toBe(403)
      expect(throughJobs.status).toBe(400)
      expect(badFilter.status).toBe(400)
      expect(queued.status).toBe(202)
      expect(job).toMatchObject({ status: "succeeded" })
      expect(job.result_summary).toMatchObject({ orders: 1, lines: 1, format: "csv" })
      expect(seenByAdmin.status).toBe(404)
      const [header, row] = text.slice(CSV_BOM.length).trim().split(/\r?\n/)
      expect(header).toContain("Sipariş no;Tarih;Durum;Müşteri")
      expect(row).toContain("Ayşe Yılmaz")
      expect(row).toContain("İstanbul;Kadıköy")
      expect(row).toContain("Ürün üzerine yazı: Ahmet & Ayşe 2026")
      expect(text).not.toContain("Demir")
      expect(audit).toEqual([
        expect.objectContaining({
          kind: "sensitive_read",
          changes: expect.objectContaining({ orders: 1, format: "csv" }) as unknown,
        }),
      ])
    })

    it("tries the picked stopped invoices again, each as its own retry, and says which could not", async () => {
      const place = await shop()
      const orderId = await place("shipped", "Yılmaz")
      const invoices = getContainer().resolve<EinvoiceModuleService>(EINVOICE_MODULE)
      const record = (status: "failed" | "pending", sourceId: string) =>
        invoices.createInvoices({
          order_id: orderId,
          kind: status === "failed" ? "sale" : "return",
          source_id: sourceId,
          provider: "external",
          status,
          next_attempt_at: new Date(),
          net_total: 100,
          vat_total: 20,
          gross_total: 120,
        })
      const stopped = await record("failed", orderId)
      const waiting = await record("pending", "rr_1")
      const operations = await createAdminUser(http, getContainer(), "operations")

      const byOperations = await post(
        "/admin/invoices/retry",
        { invoice_ids: [stopped.id] },
        operations.headers
      )
      const empty = await post("/admin/invoices/retry", { invoice_ids: [] })
      const retried = await post<{
        results: { invoice_id: string; ok: boolean; error: string | null }[]
      }>("/admin/invoices/retry", { invoice_ids: [stopped.id, waiting.id, "inv_NONE0001"] })
      const [after] = await invoices.listInvoices({ id: stopped.id })

      expect(byOperations.status).toBe(403)
      expect(empty.status).toBe(400)
      expect(retried.status).toBe(200)
      expect(retried.data.results).toEqual([
        { invoice_id: stopped.id, ok: true, error: null, message: null },
        expect.objectContaining({
          invoice_id: waiting.id,
          ok: false,
          error: "einvoice.not_failed",
        }),
        expect.objectContaining({ invoice_id: "inv_NONE0001", ok: false }),
      ])
      expect(after).toMatchObject({ status: "pending", attempts: 0 })
    })
  },
})
