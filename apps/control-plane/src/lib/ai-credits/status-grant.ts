import type { MedusaContainer } from "@medusajs/framework/types"
import { aiCreditsStatusSchema } from "@qticaret/types/control-plane"
import type { AiCreditsStatus } from "@qticaret/types/control-plane"
import { monthlyGrantOf } from "./rollover"

type Container = Pick<MedusaContainer, "resolve">

/**
 * The shop's status with its month's whole grant beside what is left of
 * it (P5b), for its panel's "kalan / toplam". Read only for an available
 * status (one unavailable says nothing more). The grant is the package's
 * as it is now (`monthlyGrantOf`, the staff wallet's `monthly_grant`): 0
 * for a package that gives none, so a shop always gets the field and an
 * empty grant reads as no bar. A month granted before the package was
 * lowered (or a grant adjusted by hand) may have more left than the
 * package gives now: the whole is then at least what is left, never a
 * remainder larger than its whole. The answer is held to the contract
 * once more, as the status was before the grant was written into it.
 */
export async function withMonthlyGrant(
  container: Container,
  tenantId: string,
  now: Date,
  status: AiCreditsStatus
): Promise<AiCreditsStatus> {
  if (!status.available) {
    return status
  }
  const { plan } = status.balance
  const grant = await monthlyGrantOf(container, tenantId, now)
  return aiCreditsStatusSchema.parse({
    ...status,
    balance: { ...status.balance, plan: { ...plan, granted: Math.max(grant, plan.remaining) } },
  })
}
