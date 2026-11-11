import type { MedusaRequest } from "@medusajs/framework/http"
import { istanbulDay } from "../../../../lib/billing/days"
import { invoiceIssuer } from "../../../../lib/billing/invoice-issuer"
import { chargeStanding, graceEndsOn, graceOf } from "../../../../lib/billing/rules"
import type { ChargeRecord } from "../../../../modules/billing/types"
import { billingIn } from "../../../../workflows/modules"
import { omit } from "../../../../lib/omit"
import { cpStaff } from "../../../http/caller"
import { actorOf, plansOf } from "../tenants/params"
import { staffNames } from "../tenants/views"

/**
 * Review L3: what staff typed (a receipt's reference often names the payer
 * or their IBAN; the reasons) goes to the owner and finance only; other
 * roles get these fields empty.
 */
const NO_FREE_TEXT = { reference: null, settle_reason: null, amount_reason: null } as const

/** Whether the caller may read what staff typed on the money: owner and finance. */
export async function readsFreeText(req: MedusaRequest): Promise<boolean> {
  const role = await cpStaff(req).roleOf(actorOf(req))
  return role === "owner" || role === "finance"
}

/** A charge as staff see it: where it stands today and its last day of grace. */
export function chargeView(
  charge: ChargeRecord,
  graceDays: number,
  today: string,
  names: Record<string, string>
) {
  return {
    ...omit(charge, "settled_by"),
    standing: charge.status === "open" ? chargeStanding(charge.due_on, graceDays, today) : null,
    grace_ends_on: graceEndsOn(charge.due_on, graceDays),
    settled_by: charge.settled_by ? (names[charge.settled_by] ?? null) : null,
  }
}

/**
 * A shop's subscription in full (GET /admin/cp/tenants/:id/subscription,
 * Ek C16): its terms and state, the grace in force, its charges newest
 * first with who settled them, the reminders sent (kind, outcome, when;
 * never to whom) and which invoice issuer runs. The references and
 * reasons only when `freeText` (owner, finance; review L3).
 */
export async function subscriptionDetail(
  req: MedusaRequest,
  tenantId: string,
  options: { freeText: boolean }
) {
  const billing = billingIn(req.scope)
  const sub = await billing.subscriptionOf(tenantId)
  const today = istanbulDay(new Date())
  if (!sub) {
    return {
      subscription: null,
      charges: [],
      reminders: [],
      today,
      invoicing: invoiceIssuer().kind,
    }
  }
  const [charges, reminders, packages] = await Promise.all([
    billing.chargesOf({ subscription_id: sub.id }),
    billing.remindersOf(tenantId),
    plansOf(req).packages({ id: sub.package_id }),
  ])
  const names = await staffNames(
    req,
    charges.map((charge) => charge.settled_by)
  )
  const grace = graceOf(sub)
  const pkg = packages[0]
  return {
    subscription: {
      ...sub,
      ...(options.freeText ? {} : { grace_override_reason: null }),
      grace_days_effective: grace,
      package: pkg ? { id: pkg.id, code: pkg.code, name: pkg.name } : null,
    },
    charges: charges.map((charge) => {
      const view = chargeView(charge, grace, today, names)
      return options.freeText ? view : { ...view, ...NO_FREE_TEXT }
    }),
    reminders,
    today,
    invoicing: invoiceIssuer().kind,
  }
}
