import type { MedusaContainer } from "@medusajs/framework/types"
import { GRANT_LIMIT_MAX } from "@qticaret/types/control-plane"
import { STALE, isStale } from "../../modules/ai-credits/sql"
import type { Stale, WalletClock } from "../../modules/ai-credits/sql"
import { StaleWallet } from "../../modules/ai-credits/service"
import { aiCreditsIn, plansIn } from "../../workflows/modules"
import { effectiveLimits } from "../plans/limits"
import { istanbulMonth } from "./period"

type Container = Pick<MedusaContainer, "resolve">

// As StaleWallet says it, should the transaction's wrapper hand back another error
const STALE_MESSAGE = new StaleWallet().message

/**
 * The credits a shop's month gives (adr/0085 K5): its own exception to
 * `ai_free_credits_per_month` while it holds, else its package's; a shop
 * without a package gets none. The same reckoning as the shop's limits
 * screen and its plan document (`effectiveLimits`), held to
 * `GRANT_LIMIT_MAX` whatever a stored value says (one written before the
 * ceiling, or past it by hand).
 */
export async function monthlyGrantOf(
  container: Container,
  tenantId: string,
  now: Date
): Promise<number> {
  const plans = plansIn(container)
  const [plan, overrides] = await Promise.all([plans.planOf(tenantId), plans.overridesOf(tenantId)])
  const grant = effectiveLimits(plan?.limits ?? null, overrides, now).find(
    (each) => each.key === "ai_free_credits_per_month"
  )?.value
  return typeof grant === "number" && Number.isSafeInteger(grant) && grant > 0
    ? Math.min(grant, GRANT_LIMIT_MAX)
    : 0
}

/**
 * A wallet change run with the month made current (§1: the roll is lazy,
 * done by the first change of a month). The grant is read from the plans
 * only when the wallet's month looks behind; a month that turns between
 * the look and the change answers `STALE` (or throws `StaleWallet` from a
 * change that must roll back), and the change runs once more with it.
 */
export async function withCurrentMonth<T>(
  container: Container,
  tenantId: string,
  now: Date,
  change: (clock: WalletClock) => Promise<T | Stale>
): Promise<T> {
  const known = await aiCreditsIn(container).planPeriodOf(tenantId)
  let grant = known === istanbulMonth(now) ? null : await monthlyGrantOf(container, tenantId, now)
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let result: T | Stale
    try {
      result = await change({ now, grant })
    } catch (error) {
      if (!(
        error instanceof StaleWallet ||
        (error instanceof Error && error.message === STALE_MESSAGE)
      )) {
        throw error
      }
      result = STALE
    }
    if (!isStale(result)) {
      return result
    }
    grant = await monthlyGrantOf(container, tenantId, now)
  }
  // With the grant read the wallet cannot be behind: only a broken clock gets here
  throw new Error("cp.ai_credit_wallet_stale")
}
