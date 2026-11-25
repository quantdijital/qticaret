import type { MedusaContainer } from "@medusajs/framework/types"
import { istanbulDay } from "../billing/days"
import { aiCreditsIn } from "../../workflows/modules"
import { istanbulMonth, nextMonthStart, spentOn } from "./period"
import { withCurrentMonth } from "./rollover"

type Container = Pick<MedusaContainer, "resolve">

export interface AiCreditBalance {
  /** This month's grant left, its month and the Istanbul day it renews (K5). */
  plan: { balance: number; period: string; renewsOn: string }
  /** Bought credits left and their last moment; null while none were bought (K6). */
  purchased: { balance: number; expiresAt: Date | null }
  /** The day's cap (the shop's or the platform's, K7), spent today and what is left. */
  daily: { cap: number; spent: number; remaining: number }
}

/**
 * A shop's credits as they stand at `now`: the month rolled and bought
 * credits past their day expired first (both write their ledger rows), so
 * what is read is what a spend would find. A shop without a wallet gets one.
 */
export async function balanceOf(
  container: Container,
  tenantId: string,
  now: Date
): Promise<AiCreditBalance> {
  const credits = aiCreditsIn(container)
  const wallet = await withCurrentMonth(container, tenantId, now, (clock) =>
    credits.currentWallet(tenantId, clock)
  )
  const period = wallet.plan_period ?? istanbulMonth(now)
  const cap = wallet.daily_cap ?? (await credits.platformValuesNow()).dailyCap
  const spent = spentOn(wallet.spent_today, wallet.spent_day, istanbulDay(now))
  return {
    plan: { balance: wallet.plan_balance, period, renewsOn: nextMonthStart(period) },
    purchased: { balance: wallet.purchased_balance, expiresAt: wallet.purchased_expires_at },
    daily: { cap, spent, remaining: Math.max(cap - spent, 0) },
  }
}
