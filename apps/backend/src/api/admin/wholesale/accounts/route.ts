import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { percentToBps } from "../../../../lib/wholesale"
import { BILLING_PROFILE_MODULE } from "../../../../modules/billing-profile"
import type BillingProfileModuleService from "../../../../modules/billing-profile/service"
import { createAccountWorkflow } from "../../../../workflows/wholesale/accounts/create"
import { readAccounts } from "../../../../workflows/wholesale/accounts/read"
import { registeredCustomer } from "../../../../workflows/wholesale/steps/account-customer"
import { queueWholesaleSync } from "../../../../workflows/wholesale/queue"
import { AUDIT_RESOURCE_ID } from "../../../http/audit/notes"
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
 * The invoice identity typed with the account, sealed here where the
 * plaintext enters (adr/0009) with the id of the customer who has a
 * sign-in at the address; the workflow writes it only to that customer.
 * A pending wholesaler's is not kept: they enter it on the storefront.
 */
async function sealedBilling(req: AuthenticatedMedusaRequest, body: AdminPostWholesaleAccountType) {
  if (body.tax_id === undefined || body.tax_office === undefined || body.company_name === null) {
    return null
  }
  const customer = await registeredCustomer(req.scope, body.email)
  if (!customer) {
    return null
  }
  const data = req.scope
    .resolve<BillingProfileModuleService>(BILLING_PROFILE_MODULE)
    .prepareProfileData(
      {
        type: "corporate",
        legal_name: body.company_name,
        tax_office: body.tax_office,
        tax_id: body.tax_id,
      },
      customer.id
    )
  return { customer_id: customer.id, data }
}

/**
 * `POST /admin/wholesale/accounts`: a new wholesaler. An address with an
 * account becomes a wholesaler at once and is told; any other is invited
 * to the storefront's sign-up page. `message` says whether the e-mail
 * went; `billing_profile` whether the invoice identity was written.
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
      billing: await sealedBilling(req, body),
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
    message: result.message,
    billing_profile: result.billing_profile,
  })
}
