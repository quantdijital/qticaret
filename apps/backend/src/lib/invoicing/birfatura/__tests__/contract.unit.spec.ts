import { validateAndTransformBody } from "@medusajs/framework/http"
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { fakeResponse } from "../../../../api/http/__tests__/fakes"
import { POST as orderStatus } from "../../../../api/hooks/birfatura/api/orderStatus/route"
import { POST as paymentMethods } from "../../../../api/hooks/birfatura/api/paymentMethods/route"
import {
  BirfaturaCargoBody,
  BirfaturaInvoiceLinkBody,
  BirfaturaOrdersBody,
} from "../../../../api/hooks/birfatura/validators"
import { invoiceDraft, invoiceItemRefs } from "../.."
import type { InvoiceOrder } from "../.."
import { parseBirfaturaDate, pullRange } from "../dates"
import { readInvoiceLink } from "../link"
import { birfaturaOrder } from "../map"
import { isBirfaturaPdfHost } from "../pdf"
import examples from "./fixtures/ozel-entegrasyon-examples.json"

/**
 * Our services against BirFatura's own examples (adr/0072 §5; "Response
 * modelleri ve alan adları büyük/küçük harf dahil dokümandaki yapıyla
 * uyumlu olmalıdır"): the requests it documents parse, and what we answer
 * has its field names, case and types.
 */

const typeOf = (value: unknown) => (Array.isArray(value) ? "array" : typeof value)

function ourOrder() {
  const order: InvoiceOrder = {
    id: "order_1",
    display_id: 41591,
    created_at: "2026-07-16T07:30:00.000Z",
    currency_code: "try",
    email: "musteri@example.com",
    items: [
      {
        id: "ordli_1",
        product_title: "Örnek Ürün",
        variant_id: "variant_1",
        variant_sku: "URN-001",
        quantity: 1,
        subtotal: 1000,
        discount_subtotal: 0,
        tax_total: 200,
        total: 1200,
        tax_lines: [{ rate: 20 }],
      },
    ],
    shipping_methods: [],
    billing_address: {
      first_name: "Örnek",
      last_name: "Müşteri",
      address_1: "Örnek Mah. Örnek Cad. No:1",
      city: "Çankaya",
      province: "Ankara",
      phone: "05000000000",
    },
    payment_collections: [
      { payments: [{ provider_id: "pp_paytr_paytr", amount: 1200, captured_at: "2026-07-16" }] },
    ],
  }
  const result = invoiceDraft(order, null, { store_url: "https://ornek.com", shipment: null })
  if (!("draft" in result)) {
    throw new Error("no draft")
  }
  const mapped = birfaturaOrder({
    draft: result.draft,
    items: invoiceItemRefs(order),
    shipping: null,
    order_id: 41591,
    order_code: "41591",
    ordered_at: new Date(order.created_at),
  })
  if (!("order" in mapped)) {
    throw new Error(mapped.problem)
  }
  return mapped.order
}

function answerOf(route: typeof orderStatus) {
  const response = fakeResponse()
  route({} as MedusaRequest, response.res)
  return response.body() as Record<string, { Id: unknown; Value: unknown }[]>
}

describe("BirFatura's documented examples (Özel Entegrasyon API)", () => {
  it("takes the documented request bodies", () => {
    expect(BirfaturaOrdersBody.safeParse(examples.orders.request).success).toBe(true)
    expect(BirfaturaCargoBody.safeParse(examples.orderCargoUpdate.request).success).toBe(true)
    expect(BirfaturaInvoiceLinkBody.safeParse(examples.invoiceLinkUpdate.request).success).toBe(
      true
    )
  })

  it("ignores a field the document does not have, and still checks the documented ones", () => {
    const extra = BirfaturaOrdersBody.safeParse({ ...examples.orders.request, Source: "x" })
    const link = BirfaturaInvoiceLinkBody.safeParse({
      ...examples.invoiceLinkUpdate.request,
      faturaEttn: "x",
    })

    expect(extra.success && extra.data).toEqual(examples.orders.request)
    expect(link.success && Object.keys(link.data)).not.toContain("faturaEttn")
    expect(
      BirfaturaOrdersBody.safeParse({ ...examples.orders.request, orderStatusId: "x" }).success
    ).toBe(false)
    expect(BirfaturaInvoiceLinkBody.safeParse({ orderId: 1 }).success).toBe(false)
  })

  it("reads ids as numbers or digit text only, never a loose conversion (security review I-3)", () => {
    const link = (orderId: unknown) =>
      BirfaturaInvoiceLinkBody.safeParse({ ...examples.invoiceLinkUpdate.request, orderId })
    const orders = (orderStatusId: unknown) =>
      BirfaturaOrdersBody.safeParse({ ...examples.orders.request, orderStatusId })

    expect(link(14948).data?.orderId).toBe(14948)
    expect(link("14948").data?.orderId).toBe(14948)
    expect(orders("1").data?.orderStatusId).toBe(1)
    for (const loose of [
      true,
      false,
      [],
      [1],
      {},
      null,
      "",
      " ",
      "0x1f",
      "1e3",
      "1.5",
      "-3",
      "+3",
      1.5,
      Infinity,
      Number.NaN,
    ]) {
      expect(link(loose).success).toBe(false)
      expect(orders(loose).success).toBe(false)
    }
    expect(link(0).success).toBe(false)
    expect(link(2 ** 53).success).toBe(false)
    expect(orders(1000).success).toBe(false)
  })

  it("ignores an extra field through Medusa's own validator too, which makes object schemas strict", async () => {
    const through = async (
      schema: Parameters<typeof validateAndTransformBody>[0],
      body: unknown
    ) => {
      const req = { body } as MedusaRequest
      let failed: unknown = null
      await validateAndTransformBody(schema)(req, {} as MedusaResponse, (error?: unknown) => {
        failed = error ?? null
      })
      return { failed, body: req.validatedBody }
    }

    const extra = await through(BirfaturaOrdersBody, { ...examples.orders.request, Source: "x" })
    const broken = await through(BirfaturaOrdersBody, {
      ...examples.orders.request,
      endDateTime: 5,
    })
    const missing = await through(BirfaturaInvoiceLinkBody, { orderId: 1, Extra: true })

    expect(extra.failed).toBeNull()
    expect(extra.body).toEqual(examples.orders.request)
    expect(broken.failed).not.toBeNull()
    expect(missing.failed).not.toBeNull()
  })

  it("reads the documented dates and range", () => {
    const { startDateTime, endDateTime } = examples.orders.request

    expect(pullRange(startDateTime, endDateTime)).not.toHaveProperty("problem")
    expect(parseBirfaturaDate(examples.orders.response.Orders[0]?.OrderDate ?? "")).not.toBeNull()
  })

  it("takes the documented invoice link: its number, date and BirFatura's file host", () => {
    const link = examples.invoiceLinkUpdate.request

    expect(readInvoiceLink(link, new Date("2026-07-17T00:00:00Z"))).toEqual({
      issued: { number: "ARS2026000000001", issued_at: new Date("2026-07-16T11:27:09Z") },
    })
    expect(isBirfaturaPdfHost(new URL(link.faturaUrl).hostname)).toBe(true)
  })

  it("answers the order states and payment methods in the documented shape", () => {
    for (const [route, key] of [
      [orderStatus, "OrderStatus"],
      [paymentMethods, "PaymentMethods"],
    ] as const) {
      const body = answerOf(route)
      const documented = (examples as unknown as Record<string, { response: object }>)[
        key === "OrderStatus" ? "orderStatus" : "paymentMethods"
      ]?.response

      expect(Object.keys(body)).toEqual(Object.keys(documented ?? {}))
      for (const item of body[key] ?? []) {
        expect(Object.keys(item)).toEqual(["Id", "Value"])
        expect(typeof item.Id).toBe("number")
        expect(typeof item.Value).toBe("string")
      }
    }
  })

  it("answers an order with documented names only, every required one filled, typed as the example", () => {
    const order = ourOrder() as unknown as Record<string, unknown>
    const example = examples.orders.response.Orders[0] as unknown as Record<string, unknown>

    for (const key of Object.keys(order)) {
      expect(examples.documentedOrderFields).toContain(key)
    }
    for (const key of examples.requiredOrderFields) {
      expect(order[key]).not.toBeNull()
      expect(order[key]).not.toBe("")
      expect(typeOf(order[key])).toBe(typeOf(example[key]))
    }
    const line = (order["OrderDetails"] as Record<string, unknown>[])[0] ?? {}
    const exampleLine = (example["OrderDetails"] as Record<string, unknown>[])[0] ?? {}
    for (const key of Object.keys(line)) {
      expect(examples.documentedLineFields).toContain(key)
    }
    for (const key of examples.requiredLineFields) {
      expect(typeOf(line[key])).toBe(typeOf(exampleLine[key]))
    }
  })

  it("gives the documented example's amounts for the same sale", () => {
    const order = ourOrder()
    const example = examples.orders.response.Orders[0]

    expect(order.TotalPaidTaxExcluding).toBe(example?.TotalPaidTaxExcluding)
    expect(order.TotalPaidTaxIncluding).toBe(example?.TotalPaidTaxIncluding)
    expect(order.ProductsTotalTaxIncluding).toBe(example?.ProductsTotalTaxIncluding)
    expect(order.OrderDate).toBe(example?.OrderDate)
    expect(order.OrderDetails[0]).toMatchObject({
      ProductCode: "URN-001",
      ProductQuantity: 1,
      VatRate: 20,
      ProductUnitPriceTaxExcluding: 1000,
      ProductUnitPriceTaxIncluding: 1200,
    })
  })
})
