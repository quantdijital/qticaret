import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { reconcilePlanDocuments } from "../../../../lib/fleet/reissue"
import { setInstructionWorkflow } from "../../../../workflows/billing/workflows"
import { billingIn } from "../../../../workflows/modules"
import { noteAuditChanges } from "../../../http/audit"
import type { PostBillingSettingsType } from "../billing/validators"
import { actorOf } from "../tenants/params"
import { staffNames } from "../tenants/views"

async function settingsView(req: AuthenticatedMedusaRequest) {
  const instruction = await billingIn(req.scope).paymentInstruction()
  const names = await staffNames(req, [instruction.updated_by])
  return {
    payment_instruction: instruction.value,
    updated_at: instruction.updated_at,
    updated_by: instruction.updated_by ? (names[instruction.updated_by] ?? null) : null,
  }
}

/**
 * GET /admin/cp/billing-settings (all staff; Ek C16): the platform's
 * payment instruction, the text every shop's Abonelik page shows. Not a
 * secret: it is what the shops are told.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  res.setHeader("Cache-Control", "no-store")
  res.json(await settingsView(req))
}

/**
 * POST /admin/cp/billing-settings (owner alone, step-up; Ek C16): the
 * payment instruction set or cleared. An account number shown to every
 * shop is a target: only the owner, proved again, and the audit keeps
 * that it changed (its length, not the text). Then every shop's document
 * carries it, issued in this request (the reconcile job covers a failure).
 */
export async function POST(
  req: AuthenticatedMedusaRequest<PostBillingSettingsType>,
  res: MedusaResponse
): Promise<void> {
  const value = req.validatedBody.payment_instruction
  const { result } = await setInstructionWorkflow(req.scope).run({
    input: { value, actor: actorOf(req) },
  })
  noteAuditChanges(req, {
    payment_instruction: {
      from: result.before === null ? null : { length: result.before.length },
      to: value === null ? null : { length: value.length },
    },
  })
  // Every shop with a package, a few at a time; one that fails is the reconcile job's
  await reconcilePlanDocuments(req.scope)
  res.json(await settingsView(req))
}
