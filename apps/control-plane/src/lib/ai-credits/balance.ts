import type { MedusaContainer } from "@medusajs/framework/types"
import type { WalletRow } from "../../modules/ai-credits/service-wallet"
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

async function balanceFrom(
  container: Container,
  wallet: WalletRow,
  now: Date
): Promise<AiCreditBalance> {
  const period = wallet.plan_period ?? istanbulMonth(now)
  const cap = wallet.daily_cap ?? (await aiCreditsIn(container).platformValuesNow()).dailyCap
  const spent = spentOn(wallet.spent_today, wallet.spent_day, istanbulDay(now))
  return {
    plan: { balance: wallet.plan_balance, period, renewsOn: nextMonthStart(period) },
    purchased: { balance: wallet.purchased_balance, expiresAt: wallet.purchased_expires_at },
    daily: { cap, spent, remaining: Math.max(cap - spent, 0) },
  }
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
  return balanceFrom(container, wallet, now)
}

/**
 * Whether `touch` would leave the wallet as it is at `now`: its month is
 * not behind and no bought credit is past its day (the same tests).
 */
export const walletIsCurrent = (wallet: WalletRow, now: Date): boolean =>
  wallet.plan_period !== null &&
  wallet.plan_period >= istanbulMonth(now) &&
  !(
    wallet.purchased_balance > 0 &&
    wallet.purchased_expires_at !== null &&
    wallet.purchased_expires_at.getTime() <= now.getTime()
  )

/**
 * `balanceOf` for a read alone (the shop's status, PR #371 D2): a wallet
 * that is already current is read without a lock or a transaction, so a
 * status poll never queues behind a call on the wallet's row; one that
 * has no wallet, whose month turned or whose bought credits ran out takes
 * `balanceOf`'s locked way and is made current. The answer is the same.
 */
export async function balanceReadOf(
  container: Container,
  tenantId: string,
  now: Date
): Promise<AiCreditBalance> {
  const wallet = await aiCreditsIn(container).walletAsIs(tenantId)
  return wallet !== null && walletIsCurrent(wallet, now)
    ? balanceFrom(container, wallet, now)
    : balanceOf(container, tenantId, now)
}
