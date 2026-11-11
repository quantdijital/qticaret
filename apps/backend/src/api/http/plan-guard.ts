import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  PLAN_RESTRICTED_MESSAGE,
  PLAN_SUSPENDED_MESSAGE,
  decidePlanWrite,
  planModeFor,
  shownStatusOf,
} from "../../lib/plan-guard"
import { rejectRequest } from "./reject"
import { routePath } from "./request-path"

/**
 * adr/0061 §5.5, Ek C15: a restricted or suspended shop's panel reads,
 * and writes only what the allow-list names (lib/plan-guard/rules.ts):
 * its orders' operations, stock, KVKK, exports, one's own account, taking
 * access away. Anything else answers 403 `plan.restricted` with the
 * status, which the panel's session hears as a sentence saying why and
 * where to look. Every caller alike (staff, an integration key); provider
 * callbacks (`/hooks/*`) and the storefront's API never pass through here.
 */
export async function guardPlanStatus(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
): Promise<void> {
  const verb = req.method.toUpperCase()
  if (verb === "GET" || verb === "HEAD" || verb === "OPTIONS") {
    next()
    return
  }
  const mode = await planModeFor(req.scope)
  if (mode === "open") {
    next()
    return
  }
  const body = req.body as { type?: unknown } | undefined
  const decision = decidePlanWrite(verb, routePath(req), {
    jobType: typeof body?.type === "string" ? body.type : undefined,
  })
  if (decision.allowed) {
    next()
    return
  }
  rejectRequest(
    req,
    res,
    403,
    { type: "not_allowed", message: PLAN_RESTRICTED_MESSAGE, status: shownStatusOf(mode) },
    `plan_${mode}_${decision.reason}`
  )
}

/**
 * An order edit is open to a restricted or suspended shop (it corrects an
 * existing order), but not one that sells: new lines (`add`) or a
 * difference the shopper owes (`expected_difference > 0`) answer 403
 * `plan.restricted` (review L1). Removals and lower prices stay open, so a
 * refund still goes out. The workflow refuses an edit whose difference is
 * not the expected one, so the expected sign is the edit's own.
 */
export async function refuseSellingEdit(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
): Promise<void> {
  const mode = await planModeFor(req.scope)
  const body = req.validatedBody as { add?: unknown[]; expected_difference?: number } | undefined
  const sells = (body?.add?.length ?? 0) > 0 || (body?.expected_difference ?? 0) > 0
  if (mode === "open" || !sells) {
    next()
    return
  }
  rejectRequest(
    req,
    res,
    403,
    { type: "not_allowed", message: PLAN_RESTRICTED_MESSAGE, status: shownStatusOf(mode) },
    `plan_${mode}_edit_sells`
  )
}

/** How long a suspended shop's checkout asks to wait: as the storefront's own page. */
export const SUSPENDED_RETRY_AFTER_SECONDS = 3600

/**
 * A suspended shop takes no new order through the storefront: `POST
 * /store/carts/:id/complete` (cash on delivery, bank transfer) and `POST
 * /store/carts/:id/payment-session` (where every payment starts, a card
 * form too) answer 503 `plan.suspended`. A payment already started
 * settles through its provider's callback, which never comes here. A
 * restricted shop sells as usual.
 */
export async function refuseSuspendedCheckout(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
): Promise<void> {
  if (req.method.toUpperCase() !== "POST" || (await planModeFor(req.scope)) !== "suspended") {
    next()
    return
  }
  res.setHeader("Retry-After", String(SUSPENDED_RETRY_AFTER_SECONDS))
  rejectRequest(
    req,
    res,
    503,
    { type: "unavailable", message: PLAN_SUSPENDED_MESSAGE },
    "plan_suspended_checkout"
  )
}
