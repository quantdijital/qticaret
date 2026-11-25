import type { Context } from "@medusajs/framework/types"
import {
  InjectManager,
  InjectTransactionManager,
  MedusaContext,
  MedusaError,
  MedusaService,
  generateEntityId,
} from "@medusajs/framework/utils"
import { istanbulMonth } from "../../lib/ai-credits/period"
import { AiCreditEntry } from "./models/entry"
import { AiCreditOperation } from "./models/operation"
import { AiCreditOrder } from "./models/order"
import { AiCreditSetting } from "./models/setting"
import { AiCreditWallet } from "./models/wallet"
import { STALE, addEntries, rowsOf, wholeCredits } from "./sql"
import type { Executor, Stale, WalletClock } from "./sql"

export interface WalletRow {
  plan_balance: number
  plan_period: string | null
  purchased_balance: number
  purchased_expires_at: Date | null
  daily_cap: number | null
  spent_today: number
  spent_day: string | null
}

export const WALLET_COLUMNS =
  "plan_balance, plan_period, purchased_balance, purchased_expires_at, daily_cap, spent_today, spent_day"

/**
 * The wallet's own changes (adr/0085 §1): every change runs in one
 * transaction that first creates the wallet if it has none and locks its
 * row (so every change to one shop's credits runs one after another, and
 * always takes the wallet before an operation or a ledger row), then rolls
 * the month and expires bought credits that are past their day, then
 * makes its change with one conditional statement and its ledger rows.
 */
export class AiCreditWallets extends MedusaService({
  AiCreditWallet,
  AiCreditEntry,
  AiCreditOperation,
  AiCreditOrder,
  AiCreditSetting,
}) {
  /** The wallet's month (a hint to read the grant before a change); undefined without a wallet. */
  @InjectManager()
  async planPeriodOf(
    tenantId: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<string | null | undefined> {
    const [row] = await rowsOf<{ plan_period: string | null }>(
      sharedContext.manager as Executor,
      "SELECT plan_period FROM ai_credit_wallet WHERE tenant_id = ? AND deleted_at IS NULL",
      [tenantId]
    )
    return row ? row.plan_period : undefined
  }

  /**
   * The wallet made current and locked for the transaction: created on the
   * first touch (two first touches at once make one), its month rolled
   * (what is left of the old month's grant expires, the new grant is
   * written once: the update holds only while the month is behind, and
   * `grant_ref` `plan:<shop>:<month>` is unique), and bought credits past
   * their day expired. `STALE` when the month is behind and the caller
   * brought no grant: nothing but the wallet's creation happened.
   */
  protected async touch(
    manager: Executor,
    tenantId: string,
    clock: WalletClock
  ): Promise<WalletRow | Stale> {
    const { now, grant } = clock
    await manager.execute(
      `INSERT INTO ai_credit_wallet
         (id, tenant_id, plan_balance, purchased_balance, spent_today, created_at, updated_at)
       VALUES (?, ?, 0, 0, 0, ?, ?)
       ON CONFLICT (tenant_id) WHERE deleted_at IS NULL DO NOTHING`,
      [generateEntityId(undefined, "aiwal"), tenantId, now, now]
    )
    const [locked] = await rowsOf<WalletRow>(
      manager,
      `SELECT ${WALLET_COLUMNS} FROM ai_credit_wallet
        WHERE tenant_id = ? AND deleted_at IS NULL FOR UPDATE`,
      [tenantId]
    )
    if (!locked) {
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "cp.ai_credit_wallet_missing")
    }
    let wallet = locked
    const period = istanbulMonth(now)
    if (wallet.plan_period === null || wallet.plan_period < period) {
      if (grant === null) {
        return STALE
      }
      const [rolled] = await rowsOf<WalletRow>(
        manager,
        `UPDATE ai_credit_wallet SET plan_balance = ?, plan_period = ?, updated_at = now()
          WHERE tenant_id = ? AND deleted_at IS NULL AND (plan_period IS NULL OR plan_period < ?)
          RETURNING ${WALLET_COLUMNS}`,
        [wholeCredits(grant), period, tenantId, period]
      )
      if (rolled) {
        await addEntries(manager, [
          {
            tenantId,
            kind: "expire",
            amount: -wallet.plan_balance,
            bucket: "plan",
            note: `plan:${wallet.plan_period ?? "-"}`,
            actor: "system",
            at: now,
          },
          {
            tenantId,
            kind: "grant_plan_monthly",
            amount: grant,
            bucket: "plan",
            grantRef: `plan:${tenantId}:${period}`,
            note: `plan:${period}`,
            actor: "system",
            at: now,
          },
        ])
        wallet = rolled
      }
    }
    if (
      wallet.purchased_balance > 0 &&
      wallet.purchased_expires_at !== null &&
      wallet.purchased_expires_at.getTime() <= now.getTime()
    ) {
      const [expired] = await rowsOf<WalletRow>(
        manager,
        `UPDATE ai_credit_wallet SET purchased_balance = 0, updated_at = now()
          WHERE tenant_id = ? AND deleted_at IS NULL
            AND purchased_balance > 0 AND purchased_expires_at <= ?
          RETURNING ${WALLET_COLUMNS}`,
        [tenantId, now]
      )
      if (expired) {
        await addEntries(manager, [
          {
            tenantId,
            kind: "expire",
            amount: -wallet.purchased_balance,
            bucket: "purchased",
            note: "purchased",
            actor: "system",
            at: now,
          },
        ])
        wallet = expired
      }
    }
    return wallet
  }

  /** The wallet made current (`touch`) and read; a shop without one gets one. */
  @InjectTransactionManager()
  async currentWallet(
    tenantId: string,
    clock: WalletClock,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<WalletRow | Stale> {
    return await this.touch(sharedContext.transactionManager as Executor, tenantId, clock)
  }
}
