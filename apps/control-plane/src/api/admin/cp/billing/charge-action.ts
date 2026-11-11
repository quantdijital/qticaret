import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { errorSummary } from "@qticaret/server-kit"
import { istanbulDay } from "../../../../lib/billing/days"
import { invoiceIssuer } from "../../../../lib/billing/invoice-issuer"
import { reissuePlanDocuments } from "../../../../lib/fleet/reissue"
import type { ChargeChange, ChargeRecord } from "../../../../modules/billing/types"
import { changeChargeWorkflow } from "../../../../workflows/billing/workflows"
import { billingIn } from "../../../../workflows/modules"
import { noteAuditChanges } from "../../../http/audit"
import { actorOf, paramOf, tenantParam } from "../tenants/params"

const NOT_OPEN = "cp.charge_not_open"

type ChangeOf = (actor: string) => ChargeChange

/** What the audit row says of a change: fields and values, never free text (a reason, a reference). */
function auditOf(change: ChargeChange, before: ChargeRecord): Record<string, unknown> {
  const charge = { id: before.id, due_on: before.due_on }
  if (change.kind === "amount") {
    return { charge, amount: { from: before.amount, to: change.amount } }
  }
  const to = change.kind === "pay" ? "paid" : change.kind === "waive" ? "waived" : "void"
  return {
    charge,
    status: { from: before.status, to },
    ...(change.kind === "pay" ? { paid_on: change.paid_on, method: change.method } : {}),
  }
}

/**
 * A staff change to a shop's charge (Ek C16; the route table holds the
 * roles and the step-up): the workflow (the charge, the subscription's
 * state, the shop restricted or active again at once), the audit row,
 * the invoice when one is issued (`none` today), then the shop's plan
 * document issued again and pushed. A charge that is not open is 409.
 */
export async function chargeAction(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
  changeOf: ChangeOf
): Promise<void> {
  const tenant = await tenantParam(req)
  const chargeId = paramOf(req, "charge_id")
  const change = changeOf(actorOf(req))
  let result
  try {
    ;({ result } = await changeChargeWorkflow(req.scope).run({
      input: {
        tenant_id: tenant.id,
        charge_id: chargeId,
        change,
        today: istanbulDay(new Date()),
      },
    }))
  } catch (error) {
    if ((error as { message?: unknown } | null)?.message === NOT_OPEN) {
      res.status(409).json({ type: "conflict", message: NOT_OPEN })
      return
    }
    throw error
  }
  noteAuditChanges(req, {
    ...auditOf(change, result.before),
    ...(result.move.moved ? { tenant_status: { from: result.move.from, to: result.move.to } } : {}),
  })
  const charge = await billingIn(req.scope).chargeOf(tenant.id, chargeId)
  if (change.kind === "pay" && charge.paid_on) {
    await issueInvoice(req, { ...charge, paid_on: charge.paid_on })
  }
  const issued = (await reissuePlanDocuments(req.scope, [tenant.id])).get(tenant.id)
  res.json({
    charge,
    subscription_status: result.status,
    tenant: { id: tenant.id, status: result.move.to },
    plan_document: issued ? { issued: issued.issued, serial: issued.serial } : null,
  })
}

/** The platform's invoice for a paid charge (adr/0061 §7): `none` issues nothing; never fails the mark. */
async function issueInvoice(
  req: AuthenticatedMedusaRequest,
  charge: ChargeRecord & { paid_on: string }
): Promise<void> {
  try {
    const invoice = await invoiceIssuer().issue(charge)
    if (invoice) {
      await billingIn(req.scope).updateCharges({
        id: charge.id,
        invoice_number: invoice.number,
        invoice_ettn: invoice.ettn,
        invoice_pdf_url: invoice.pdf_url,
      })
    }
  } catch (error) {
    req.scope
      .resolve(ContainerRegistrationKeys.LOGGER)
      .warn(
        `cp.billing_invoice_failed ${JSON.stringify({ charge_id: charge.id, err: errorSummary(error) })}`
      )
  }
}
