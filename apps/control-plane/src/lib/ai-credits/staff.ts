import type { MedusaContainer } from "@medusajs/framework/types"
import type { AiCreditOrderStatus } from "@qticaret/types/control-plane"
import type { AiCreditEntryView, AiCreditOrderRow, Page } from "../../modules/ai-credits/service"
import { aiCreditsIn } from "../../workflows/modules"
import { balanceOf } from "./balance"
import type { AiCreditBalance } from "./balance"
import { withCurrentMonth } from "./rollover"

type Container = Pick<MedusaContainer, "resolve">

/**
 * What the owner reads and sets of a shop's credits (adr/0085 §5): its
 * wallet with the ledger page by page, its own day's cap; the requests.
 */

export interface WalletAsStaff {
  balance: AiCreditBalance
  /** The shop's own day's cap; null: the platform's. */
  ownDailyCap: number | null
  ledger: Page<AiCreditEntryView>
}

/** A shop's wallet as it stands at `now` (made current like any read) and a page of its ledger. */
export async function walletAsStaff(
  container: Container,
  tenantId: string,
  page: { limit: number; offset: number },
  now: Date
): Promise<WalletAsStaff> {
  const balance = await balanceOf(container, tenantId, now)
  const credits = aiCreditsIn(container)
  const [ledger, ownDailyCap] = await Promise.all([
    credits.ledgerOf(tenantId, page),
    credits.ownDailyCapOf(tenantId),
  ])
  return { balance, ownDailyCap, ledger }
}

/** A shop's own day's cap set (K7), or null for the platform's; before and after for the audit. */
export async function setDailyCap(
  container: Container,
  input: { tenantId: string; cap: number | null; now: Date }
): Promise<{ before: number | null; after: number | null }> {
  const credits = aiCreditsIn(container)
  return await withCurrentMonth(container, input.tenantId, input.now, (clock) =>
    credits.setDailyCap(input.tenantId, input.cap, clock)
  )
}

/** Every shop's requests, newest first; `status` narrows them. */
export async function ordersAsStaff(
  container: Container,
  input: { status: AiCreditOrderStatus | null; limit: number; offset: number }
): Promise<Page<AiCreditOrderRow>> {
  return await aiCreditsIn(container).ordersByStatus(input.status, input)
}

/** One request, any shop's (the routes' audit row names its shop). */
export async function orderAsStaff(
  container: Container,
  orderId: string
): Promise<AiCreditOrderRow> {
  return await aiCreditsIn(container).orderAsStaff(orderId)
}

/** A shop's pending request, or null. */
export async function pendingOrderOf(
  container: Container,
  tenantId: string
): Promise<AiCreditOrderRow | null> {
  return await aiCreditsIn(container).pendingOrderOf(tenantId)
}
