import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { RETURN_REQUESTS_MODULE } from "../../../../../modules/return-requests"
import type ReturnRequestsModuleService from "../../../../../modules/return-requests/service"
import { liraOf } from "../../../../admin/return-requests/view"
import { requestReturnCode } from "../../../../../lib/shipping/contracted-return"
import type { ContractedReturn } from "../../../../../lib/shipping/contracted-return"
import { readContractedReturn } from "../../../../../workflows/returns/contracted-return"
import { requestReturn } from "../../../../../workflows/returns/request-return"
import type { StorePostReturnRequestType } from "../../../../admin/return-requests/validators"
import { orderAccessOf } from "../../../../http/order-access"

/**
 * What a shopper sees of their request: its state and the code to say at
 * the carrier's branch with that carrier's name (the shop's contracted
 * return code while approved, adr/0031 Ek 2026-11-26),
 * an exchange's variants and cost (exact lira), the units refused at
 * receipt and why (a sealed good opened, MSY md. 15/1-ç), never staff
 * notes' authors nor why staff cancelled one.
 */
const view = (request: Record<string, unknown>, contracted: ContractedReturn | null) => ({
  id: request["id"],
  kind: request["kind"],
  status: request["status"],
  reason: request["reason"],
  items: request["items"],
  refused_items: request["refused_items"] ?? null,
  exchange_items: request["exchange_items"],
  difference: typeof request["difference"] === "number" ? liraOf(request["difference"]) : null,
  // A cancelled request's code no longer takes a parcel: none to hand over
  ...requestReturnCode(
    {
      status: String(request["status"]),
      return_code: typeof request["return_code"] === "string" ? request["return_code"] : null,
    },
    contracted
  ),
  decision_note: request["decision_note"],
  created_at: request["created_at"],
})

/**
 * POST /store/orders/:id/returns (F7.9): the shopper asks to send lines
 * back, signed in or with the order's key (adr/0037 §2).
 */
export async function POST(
  req: MedusaRequest<StorePostReturnRequestType>,
  res: MedusaResponse
): Promise<void> {
  const { kind, items, reason, note } = req.validatedBody
  const access = orderAccessOf(req)
  const created = await requestReturn(req.scope, {
    order_id: access.order_id,
    customer_id: access.customer_id ?? "",
    kind,
    items,
    reason,
    note: note ?? null,
  })
  // Just asked: waiting for the shop, no code yet
  res.json({ return_request: view(created, null) })
}

/** GET /store/orders/:id/returns: the shopper's requests on their own order (`orderAccess`). */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const orderId = orderAccessOf(req).order_id
  const requests = await req.scope
    .resolve<ReturnRequestsModuleService>(RETURN_REQUESTS_MODULE)
    .listReturnRequests({ order_id: orderId }, { order: { created_at: "DESC" } })
  const contracted = requests.some((request) => request.status === "approved")
    ? await readContractedReturn(req.scope)
    : null
  res.json({
    return_requests: requests.map((request) =>
      view(request as unknown as Record<string, unknown>, contracted)
    ),
  })
}
