import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { EINVOICE_MODULE } from "../../../modules/einvoice"
import type EinvoiceModuleService from "../../../modules/einvoice/service"
import { isProgram } from "./reach"
import { invoiceView } from "./view"
import type { AdminGetInvoicesType } from "./validators"

/**
 * GET /admin/invoices (F8, adr/0034 §9): the shop's invoices, the failed
 * first, then the newest; for staff, and for a key with `invoices:read`
 * (an external program lists what waits for it: sale invoices only,
 * `reach.ts`). No buyer in them.
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
  res.json({
    invoices: rows.map((row) => ({
      ...invoiceView(row),
      order_display_id: numbers.get(row.order_id) ?? null,
    })),
    count,
    limit,
    offset,
  })
}
