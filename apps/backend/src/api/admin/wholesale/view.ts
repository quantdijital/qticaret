import type { MedusaRequest } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { toMedusaAmount } from "../../../lib/money"
import type { Kurus } from "../../../lib/money"
import { bpsToPercent } from "../../../lib/wholesale"
import { WHOLESALE_MODULE } from "../../../modules/wholesale"
import type WholesaleModuleService from "../../../modules/wholesale/service"
import type { WholesaleLine } from "../../../workflows/wholesale/lines"

type TierRecord = Awaited<ReturnType<WholesaleModuleService["retrieveWholesaleTier"]>>

/**
 * A level as the panel reads it. Its Medusa group and list ids stay
 * inside: the routes take a level's id only (ADR-0068 §9, IDOR).
 */
export const tierView = (tier: TierRecord) => ({
  id: tier.id,
  name: tier.name,
  percent: tier.rate_bps === null ? null : bpsToPercent(tier.rate_bps),
  min_quantity: tier.min_quantity ?? null,
  // A rate's rows still to be written by the sync job
  sync_pending:
    tier.sync_requested_at !== null &&
    (tier.synced_at === null || new Date(tier.synced_at) < new Date(tier.sync_requested_at)),
  synced_at: tier.synced_at,
  created_at: tier.created_at,
})

const lira = (amount: Kurus | null) => (amount === null ? null : toMedusaAmount(amount))

export const lineView = (line: WholesaleLine) => ({
  ...line,
  net: toMedusaAmount(line.net),
  gross: toMedusaAmount(line.gross),
  base: lira(line.base),
  retail_now: lira(line.retail_now),
  vat_percent: line.vat_bps / 100,
})

/** The level named by the route, or 404. */
export async function tierOf(req: MedusaRequest): Promise<TierRecord> {
  const [tier] = await req.scope
    .resolve<WholesaleModuleService>(WHOLESALE_MODULE)
    .listWholesaleTiers({ id: req.params["id"] ?? "" }, { take: 1 })
  if (!tier) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "wholesale.tier_unknown")
  }
  return tier
}
