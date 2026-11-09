import { existsSync, readFileSync, rmSync } from "node:fs"
import type { ICartModuleService, MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  beginOrderEditOrderWorkflow,
  confirmOrderEditRequestWorkflow,
  createOrderFulfillmentWorkflow,
  markOrderFulfillmentAsDeliveredWorkflow,
  orderEditUpdateItemQuantityWorkflow,
  requestOrderEditRequestWorkflow,
} from "@medusajs/medusa/core-flows"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { startFakeMail } from "@qticaret/testing"
import type { FakeMail } from "@qticaret/testing"
import { readPackingSlips } from "../../src/api/admin/packing-slips/read"
import { invoiceLines } from "../../src/lib/invoicing/lines"
import { ASYNC_JOB_MODULE } from "../../src/modules/async-job"
import type AsyncJobModuleService from "../../src/modules/async-job/service"
import { exportBatch } from "../../src/workflows/async-job/types/order-export-read"
import { loadOrderMessage } from "../../src/workflows/messaging/loaders/order"
import { createAdminUser } from "../helpers/admin"
import { registerCustomer } from "../helpers/customer"
import { eventually } from "../helpers/eventually"
import { filesNamed } from "../helpers/files"
import { BANK_TRANSFER } from "../helpers/gift-sale"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { readyCart } from "../helpers/paytr"
import { stockShop, stockedProduct } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(240 * 1000)

// What the buyer typed: a person's name, in ASCII so a column's text finds it as stored
const TYPED = "Nazli Ozkan"

const MAIL_ENV = ["EMAIL_TRANSPORT", "RESEND_API_KEY", "RESEND_BASE_URL", "EMAIL_FROM"]

type Answer = { message?: string } & Record<string, unknown>

const ADDONS = [
  {
    kind: "text",
    label: "Ürün üzerine yazı",
    price: 35,
    non_withdrawable: true,
    text: { max_length: 50 },
  },
]

/**
 * The columns of the tenant's database that hold `needle` as text: every
 * text and JSON column of every table, `table.column` each.
 */
async function columnsHolding(container: MedusaContainer, needle: string): Promise<string[]> {
  const pg = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const columns = (await pg("information_schema.columns")
    .select("table_name", "column_name")
    .where({ table_schema: "public" })
    .whereIn("data_type", ["text", "character varying", "json", "jsonb"])) as {
    table_name: string
    column_name: string
  }[]
  const found: string[] = []
  for (const { table_name, column_name } of columns) {
    const [row] = await pg(table_name)
      .count<{ n: string | number }[]>({ n: "*" })
      .whereRaw("??::text like ?", [column_name, `%${needle}%`])
    if (Number(row?.n ?? 0) > 0) {
      found.push(`${table_name}.${column_name}`)
    }
  }
  return found.sort()
}

/**
 * adr/0052 §10 (Ek 2026-11-09): a KVKK erasure takes the text typed on an
 * add-on line out of every copy kept of the order: the line item, each
 * order version's item, the cart's line, the checkout's stored run and the
 * order list's files; whichever way the order is read after, it is gone.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let fake: FakeMail

    beforeAll(async () => {
      fake = await startFakeMail()
      Object.assign(process.env, {
        EMAIL_TRANSPORT: "resend",
        RESEND_API_KEY: fake.apiKey,
        RESEND_BASE_URL: fake.url,
        EMAIL_FROM: "bildirim@platform.example",
      })
    })

    afterAll(async () => {
      for (const name of MAIL_ENV) {
        Reflect.deleteProperty(process.env, name)
      }
      await fake.close()
      for (const path of filesNamed(/siparisler-.*\.csv$/)) {
        rmSync(path, { force: true })
      }
    })

    it("erases a typed add-on text from every stored copy and every read of the order", async () => {
      const container = getContainer()
      await loadTrAddressFixture(container)
      const shop = await stockShop(container)
      const store = await createStorefront(container)
      const admin = await createAdminUser(http, container)
      const post = (url: string, body: unknown, headers = admin.headers) =>
        settle(http.post<Answer>(url, body, { headers }))
      const get = (url: string, headers = admin.headers) =>
        settle(http.get<Answer>(url, { headers }))
      const jobs = container.resolve<AsyncJobModuleService>(ASYNC_JOB_MODULE)
      await post("/admin/features/catalog.addons", { enabled: true })
      await post("/admin/platform-settings/bank_transfer", {
        enabled: true,
        account_holder: "Örnek Ticaret A.Ş.",
        bank_name: "Örnek Bankası",
        iban: "TR330006100519786457841326",
        deadline_hours: 24,
      })

      // A product with a text add-on; a customer's order with a name typed on it
      const product = await stockedProduct(container, shop, "caki-silme", 20, 1000)
      const saved = await post(`/admin/products/${product.productId}/catalog`, { addons: ADDONS })
      const [addon] = (saved.data["addons"] ?? []) as { id: string }[]
      const customer = await registerCustomer(http, store)
      const cartId = await readyCart(container, shop, product.variantId, undefined, 1)
      await container
        .resolve<ICartModuleService>(Modules.CART)
        .updateCarts(cartId, { customer_id: customer.id, email: customer.email })
      const query = container.resolve(ContainerRegistrationKeys.QUERY)
      const { data: carts } = await query.graph({
        entity: "cart",
        fields: ["items.id"],
        filters: { id: cartId },
      })
      const cartLineId = (carts[0] as { items: { id: string }[] }).items[0]?.id ?? ""
      const picked = await post(
        `/store/carts/${cartId}/line-items/${cartLineId}/addons`,
        { selections: [{ addon_id: addon?.id, value: TYPED }] },
        store.headers
      )
      await post(
        `/store/carts/${cartId}/payment-session`,
        { provider_id: BANK_TRANSFER },
        store.headers
      )
      const placed = await post(`/store/carts/${cartId}/complete`, {}, store.headers)
      const orderId = (placed.data["order"] as { id: string }).id
      const { data: lines } = await query.graph({
        entity: "order",
        fields: ["items.id"],
        filters: { id: orderId },
      })
      const lineId = (lines[0] as { items: { id: string }[] }).items[0]?.id ?? ""

      // A Medusa order edit: the order's next version copies the item's metadata
      await beginOrderEditOrderWorkflow(container).run({ input: { order_id: orderId } })
      await orderEditUpdateItemQuantityWorkflow(container).run({
        input: { order_id: orderId, items: [{ id: lineId, quantity: 2 }] },
      })
      await requestOrderEditRequestWorkflow(container).run({ input: { order_id: orderId } })
      await confirmOrderEditRequestWorkflow(container).run({ input: { order_id: orderId } })

      // Delivered: an erasure waits for an order on its way
      const items = [{ id: lineId, quantity: 2 }]
      const { result: parcel } = await createOrderFulfillmentWorkflow(container).run({
        input: { order_id: orderId, items },
      })
      await markOrderFulfillmentAsDeliveredWorkflow(container).run({
        input: { orderId, fulfillmentId: parcel.id },
      })

      // The order's page through its e-mail's key, and the order list as a file
      const key = await post(`/store/carts/${cartId}/order-access`, {}, store.headers)
      const orderKey = { ...store.headers, "x-order-token": String(key.data["token"]) }
      const pageBefore = await get(`/store/orders/${orderId}`, orderKey)
      const queued = await post("/admin/order-board/export", { format: "csv" })
      const jobId = (queued.data["async_job"] as { id: string }).id
      const job = await eventually(
        () => jobs.retrieveAsyncJob(jobId),
        (each) => each.status !== "queued" && each.status !== "running",
        100
      )
      const csv = filesNamed(/siparisler-.*\.csv$/)[0] ?? ""
      const exportedBefore = readFileSync(csv, "utf8")
      const mail = await eventually(
        () => Promise.resolve(fake.messages.find((each) => each.template === "order_placed")),
        Boolean
      )
      const before = await columnsHolding(container, TYPED)

      // The customer's erasure, as the panel asks it
      const erasure = await post(`/admin/customers/${customer.id}/privacy-requests`, {
        kind: "erasure",
        channel: "letter",
        received_at: new Date().toISOString(),
      })
      const erasureId = (erasure.data["privacy_request"] as { id: string }).id
      const erased = await post(`/admin/privacy-requests/${erasureId}/erase`, {})

      // Every way the order is read after
      const adminOrder = await get(`/admin/orders/${orderId}?fields=*items`)
      const pageAfter = await get(`/store/orders/${orderId}`, orderKey)
      const message = await loadOrderMessage(container, orderId)
      const slips = await readPackingSlips(container, [orderId])
      const exported = await exportBatch(container, [orderId])
      const { data: versioned } = await query.graph({
        entity: "order",
        fields: [
          "total",
          "items.id",
          "items.title",
          "items.product_title",
          "items.variant_title",
          "items.quantity",
          "items.total",
          "items.subtotal",
          "items.tax_total",
          "items.metadata",
          "items.line_item_metadata",
          "items.detail.metadata",
        ],
        filters: { id: orderId },
      })
      const invoice = invoiceLines(versioned[0] as Parameters<typeof invoiceLines>[0])
      const board = await get(`/admin/order-board?customer_id=${customer.id}`)
      const exportJob = await jobs.retrieveAsyncJob(jobId)
      const after = await columnsHolding(container, TYPED)

      expect(picked.status).toBe(200)
      expect(placed.status).toBe(200)
      expect(job.status).toBe("succeeded")
      // Before: the page, the file and the e-mail show it; stored on each copy Medusa keeps
      expect(pageBefore.status).toBe(200)
      expect(JSON.stringify(pageBefore.data)).toContain(TYPED)
      expect(exportedBefore).toContain(TYPED)
      expect(mail?.html).toContain(TYPED)
      expect(before).toEqual([
        "cart_line_item.metadata",
        "order_item.metadata",
        "order_line_item.metadata",
        "workflow_execution.context",
      ])
      expect(erased.status).toBe(200)
      for (const read of [
        adminOrder.data,
        pageAfter.data,
        message,
        slips,
        exported,
        versioned,
        invoice,
        board.data,
      ]) {
        expect(JSON.stringify(read)).not.toContain(TYPED)
      }
      // The books keep the add-on's name and price, and the line stays outside withdrawal
      const item = (versioned[0] as { items: { metadata: Record<string, unknown> }[] }).items[0]
      expect(item?.metadata["qt_addons"]).toMatchObject({
        non_withdrawable: true,
        items: [expect.objectContaining({ label: "Ürün üzerine yazı", value: "—", amount: 35 })],
      })
      // The order list's file is gone; nothing in the database holds the text
      expect(exportJob.result_file_id).toBeNull()
      expect(existsSync(csv)).toBe(false)
      expect(after).toEqual([])
    })
  },
})
