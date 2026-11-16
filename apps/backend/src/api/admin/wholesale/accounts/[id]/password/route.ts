import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ConflictError, ValidationError } from "../../../../../../lib/errors"
import { normalizeEmail } from "../../../../../../lib/wholesale"
import { setWholesalerPasswordWorkflow } from "../../../../../../workflows/wholesale/accounts/password"
import { sealPassword } from "../../../../../../workflows/wholesale/steps/login-password"
import { AUDIT_RESULT } from "../../../../../http/audit/notes"
import { newPasswordProblem } from "../../../../../http/password-policy"
import type { AdminPostWholesalePasswordType } from "../../../account-validators"
import { accountViewOf } from "../../../account-view"

/**
 * `POST /admin/wholesale/accounts/:id/password` (ADR-0068 Ek 2026-11-15
 * (2)): staff type the wholesaler a new password, by the platform's rule;
 * every older sign-in of theirs ends. The audit entry says it changed,
 * never what to.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostWholesalePasswordType>,
  res: MedusaResponse
): Promise<void> {
  const account = await accountViewOf(req)
  if (!account.customer || !account.email) {
    throw new ConflictError("wholesale.account_not_bound")
  }
  const email = normalizeEmail(account.email)
  const problem = await newPasswordProblem(req.validatedBody.password, email)
  if (problem) {
    throw new ValidationError(problem, { field: "password" })
  }
  await setWholesalerPasswordWorkflow(req.scope).run({
    input: {
      id: account.id,
      email,
      sealed_password: sealPassword(email, req.validatedBody.password),
    },
  })
  res.locals[AUDIT_RESULT] = { password_changed: true, signed_out: true }
  res.json({ account: await accountViewOf(req, account.id), signed_out: true })
}
