import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { BIRFATURA_STATUSES, pullRange } from "../../../../../lib/invoicing/birfatura"
import { errorSummary, logger } from "../../../../../lib/logging"
import { EINVOICE_MODULE } from "../../../../../modules/einvoice"
import type EinvoiceModuleService from "../../../../../modules/einvoice/service"
import { birfaturaOrders } from "../../../../../workflows/einvoice/birfatura-orders"
import { rejectRequest } from "../../../../http/reject"
import { answer, auditBirfatura } from "../../respond"
import type { BirfaturaOrdersBodyType } from "../../validators"

/**
 * POST /hooks/birfatura/api/orders (adr/0072 §3, §5): the sale invoices
 * waiting for BirFatura, queued within the range, as its `Orders[]`. Only
 * the "ready" state returns any. Hands out buyers' details: the pull is
 * recorded (ids only) before the answer, and refused with 503 when the
 * record cannot be written. What it hands out is stamped listed.
 */
export async function POST(
  req: MedusaRequest<BirfaturaOrdersBodyType>,
  res: MedusaResponse
): Promise<void> {
  const body = req.validatedBody
  const range = pullRange(body.startDateTime, body.endDateTime)
  if ("problem" in range) {
    answer(res, false, "range_invalid", 400)
    return
  }
  const pulled =
    body.orderStatusId === BIRFATURA_STATUSES.ready
      ? await birfaturaOrders(req.scope, range)
      : { orders: [], listed: [], skipped: [] }
  try {
    await auditBirfatura(req, {
      kind: "sensitive_read",
      action: "birfatura.orders_pulled",
      resource_id: null,
      outcome: 200,
      changes: {
        status: body.orderStatusId,
        from: range.start.toISOString(),
        to: range.end.toISOString(),
        orders: pulled.listed.length,
        listed: pulled.listed,
        skipped: pulled.skipped,
      },
    })
  } catch (error) {
    logger.error({
      event: "audit.write_failed",
      action: "birfatura.orders_pulled",
      err: errorSummary(error),
    })
    rejectRequest(
      req,
      res,
      503,
      { type: "temporarily_unavailable", message: "errors.temporarily_unavailable" },
      "audit_unavailable"
    )
    return
  }
  // Handed out from now on: a canceled order's invoice is flagged for staff, never cancelled here
  await req.scope
    .resolve<EinvoiceModuleService>(EINVOICE_MODULE)
    .markListed(pulled.listed.map((row) => row.invoice_id))
  res.setHeader("Cache-Control", "no-store")
  res.json({ Orders: pulled.orders })
}
