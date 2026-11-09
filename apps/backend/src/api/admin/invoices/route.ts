import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { EINVOICE_MODULE } from "../../../modules/einvoice"
import type EinvoiceModuleService from "../../../modules/einvoice/service"
import { orderSaleHold } from "../../../workflows/einvoice/order-hold"
import type { SaleHold } from "../../../workflows/einvoice/order-hold"
import { isProgram } from "./reach"
import { invoiceView } from "./view"
import type { AdminGetInvoicesType } from "./validators"

/**
 * GET /admin/invoices (F8, adr/0034 §9): the shop's invoices, the failed
 * first, then the newest; for staff, and for a key with `invoices:read`
 * (an external program lists what waits for it: sale invoices only,
 * `reach.ts`). No buyer in them. One order's, for staff, say why it has
 * no sale invoice when it has none (`sale_hold`).
 */
export async function GET(
  req: MedusaRequest<unknown, AdminGetInvoicesType>,
  res: MedusaResponse
): Promise<void> {
  const { limit, offset, ...filters } = req.validatedQuery
  const [rows, count] = await req.scope
    .resolve<EinvoiceModuleService>(EINVOICE_MODULE)
    .listAndCountInvoices(isProgram(req) ? { ...filters, kind: "sale" } : filters, {
      take: limit,
      skip: offset,
      order: { status: "ASC", created_at: "DESC" },
    })
  // The orders' numbers, for the list to name them by
  const orderIds = [...new Set(rows.map((row) => row.order_id))]
  const { data } = orderIds.length
    ? await req.scope.resolve(ContainerRegistrationKeys.QUERY).graph({
        entity: "order",
        fields: ["id", "display_id"],
        filters: { id: orderIds },
      })
    : { data: [] }
  const numbers = new Map(
    (data as unknown as { id: string; display_id: number }[]).map((order) => [
      order.id,
      order.display_id,
    ])
  )
  const invoices = rows.map((row) => ({
    ...invoiceView(row),
    order_display_id: numbers.get(row.order_id) ?? null,
  }))
  res.json({
    invoices,
    count,
    limit,
    offset,
    ...(await saleHoldFor(req, invoices)),
  })
}

/**
 * An order's invoices asked by staff, and no sale invoice of its own among
 * them: why not (`sale_hold`, the queue's rule), for the order page to say
 * so instead of an empty card. Absent from other lists.
 */
async function saleHoldFor(
  req: MedusaRequest<unknown, AdminGetInvoicesType>,
  invoices: { kind: string; for_exchange: boolean }[]
): Promise<{ sale_hold?: SaleHold | null }> {
  const { order_id, status, offset } = req.validatedQuery
  if (!order_id || status !== undefined || offset > 0 || isProgram(req)) {
    return {}
  }
  if (invoices.some((row) => row.kind === "sale" && !row.for_exchange)) {
    return { sale_hold: null }
  }
  return { sale_hold: await orderSaleHold(req.scope, order_id) }
}
