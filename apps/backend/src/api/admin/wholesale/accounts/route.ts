import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ValidationError } from "../../../../lib/errors"
import { sealForRequest } from "../../../../lib/staff/account"
import { normalizeEmail, percentToBps } from "../../../../lib/wholesale"
import { createAccountWorkflow } from "../../../../workflows/wholesale/accounts/create"
import { readAccounts } from "../../../../workflows/wholesale/accounts/read"
import { billingBinding } from "../../../../workflows/wholesale/steps/account-customer"
import type { TypedBilling } from "../../../../workflows/wholesale/steps/account-customer"
import { sealPassword } from "../../../../workflows/wholesale/steps/login-password"
import { queueWholesaleSync } from "../../../../workflows/wholesale/queue"
import { AUDIT_RESOURCE_ID } from "../../../http/audit/notes"
import { newPasswordProblem } from "../../../http/password-policy"
import type {
  AdminGetWholesaleAccountsType,
  AdminPostWholesaleAccountType,
} from "../account-validators"
import { accountView, accountViewOf } from "../account-view"

/** `GET /admin/wholesale/accounts` (ADR-0068 §3): a page of wholesalers, newest first. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const query = req.validatedQuery as unknown as AdminGetWholesaleAccountsType
  const { accounts, count } = await readAccounts(req.scope, query)
  res.json({
    accounts: accounts.map(accountView),
    count,
    limit: query.limit,
    offset: query.offset,
  })
}

/**
 * The invoice identity typed with the account (adr/0009), sealed here
 * where the plaintext enters, for this request only; the workflow opens
 * it once the customer is known and encrypts it for them.
 */
function sealedBilling(body: AdminPostWholesaleAccountType): string | null {
  if (body.tax_id === undefined || body.tax_office === undefined || body.company_name === null) {
    return null
  }
  const typed: TypedBilling = {
    legal_name: body.company_name,
    tax_office: body.tax_office,
    tax_id: body.tax_id,
  }
  return sealForRequest(JSON.stringify(typed), billingBinding(normalizeEmail(body.email)))
}

/** The typed password by the platform's rule (adr/0043), then sealed; none typed, null. */
async function sealedPassword(body: AdminPostWholesaleAccountType): Promise<string | null> {
  if (body.password === undefined) {
    return null
  }
  const email = normalizeEmail(body.email)
  const problem = await newPasswordProblem(body.password, email)
  if (problem) {
    throw new ValidationError(problem, { field: "password" })
  }
  return sealPassword(email, body.password)
}

/**
 * `POST /admin/wholesale/accounts` (ADR-0068 Ek 2026-11-15 (2)): a new
 * wholesaler, active at once. `password` says whether staff's password
 * was set (a new sign-in), replaced (an unconfirmed sign-up taken over)
 * or not applied (a customer who proved the address keeps theirs);
 * `billing_profile` whether the invoice identity was written.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostWholesaleAccountType>,
  res: MedusaResponse
): Promise<void> {
  const body = req.validatedBody
  const actor = req.auth_context.actor_id || null
  const { result } = await createAccountWorkflow(req.scope).run({
    input: {
      email: body.email,
      company_name: body.company_name,
      contact_name: body.contact_name,
      tier_id: body.tier_id,
      own_prices: body.own_prices,
      rate_bps: body.percent === null ? null : percentToBps(body.percent),
      min_quantity: body.min_quantity,
      sealed_password: await sealedPassword(body),
      take_over: body.take_over,
      billing: sealedBilling(body),
      created_by: actor,
    },
  })
  if (body.percent !== null) {
    await queueWholesaleSync(req.scope, actor)
  }
  // The entry names the account made (review I1)
  res.locals[AUDIT_RESOURCE_ID] = result.id
  res.status(201).json({
    account: await accountViewOf(req, result.id),
    password: result.password,
    billing_profile: result.billing_profile,
  })
}
