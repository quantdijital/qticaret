import type { MedusaRequest } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { ConflictError } from "../../../lib/errors"
import { bpsToPercent } from "../../../lib/wholesale"
import type { AccountRead } from "../../../workflows/wholesale/accounts/read"
import { readAccount } from "../../../workflows/wholesale/accounts/read"
import { accountById } from "../../../workflows/wholesale/steps/account-rows"
import type { SyncListInput } from "../../../workflows/wholesale/sync"

/** A wholesaler as the panel reads it: the rate as a percentage, no Medusa ids. */
export const accountView = ({ rate_bps, ...account }: AccountRead) => ({
  ...account,
  percent: rate_bps === null ? null : bpsToPercent(rate_bps),
})

const missing = () => new MedusaError(MedusaError.Types.NOT_FOUND, "wholesale.account_unknown")

/** The wholesaler named by the route as the panel reads it, or 404. */
export async function accountViewOf(req: MedusaRequest, id = req.params["id"] ?? "") {
  const account = await readAccount(req.scope, id)
  if (!account) {
    throw missing()
  }
  return accountView(account)
}

/** The route's account id, known, or 404. */
export async function accountIdOf(req: MedusaRequest): Promise<string> {
  return (await accountById(req.scope, req.params["id"] ?? "")).id
}

/**
 * The wholesaler's own list as the price writers take it, its ids read
 * from the module (§9); 409 while the account has none: the panel opens
 * it with `own_prices` first.
 */
export async function ownListOf(req: MedusaRequest): Promise<SyncListInput["list"]> {
  const account = await accountById(req.scope, req.params["id"] ?? "")
  if (!account.private_price_list_id || !account.private_group_id) {
    throw new ConflictError("wholesale.own_prices_off")
  }
  return {
    kind: "private",
    price_list_id: account.private_price_list_id,
    customer_group_id: account.private_group_id,
    rate_bps: account.rate_bps ?? null,
  }
}
