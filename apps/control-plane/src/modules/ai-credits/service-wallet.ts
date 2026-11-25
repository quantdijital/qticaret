import type { Context } from "@medusajs/framework/types"
import {
  InjectManager,
  InjectTransactionManager,
  MedusaContext,
  MedusaError,
  MedusaService,
  generateEntityId,
} from "@medusajs/framework/utils"
import { addMonths, istanbulMonth } from "../../lib/ai-credits/period"
import { AI_PURCHASED_LIFETIME_MONTHS } from "../../lib/ai-credits/settings"
import { AiCreditEntry } from "./models/entry"
import { AI_CREDIT_BUCKETS } from "./models/entry"
import type { AiCreditBucket } from "./models/entry"
import { AiCreditOperation } from "./models/operation"
import { AiCreditOrder } from "./models/order"
import { AiCreditWallet } from "./models/wallet"
import { STALE, addEntries, isStale, rowsOf, wholeCredits } from "./sql"
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

const WALLET_COLUMNS =
  "plan_balance, plan_period, purchased_balance, purchased_expires_at, daily_cap, spent_today, spent_day"

export interface PurchaseGrant {
  tenantId: string
  credits: number
  /** Names the grant once (`order:<id>`, a staff top-up's own reference). */
  grantRef: string
  actor: string
  note?: string | null
}

export interface Adjustment {
  tenantId: string
  /** Signed: a staff member adds or takes credits. */
  amount: number
  bucket: AiCreditBucket
  note: string
  actor: string
}

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

  /**
   * Bought credits added once (K6, K11): the ledger row goes in first and
   * its unique `grant_ref` decides; a reference already written changes
   * nothing (`applied: false`), also when two arrive at once. Every top-up
   * moves the whole bought balance's last day to now plus its life.
   */
  @InjectTransactionManager()
  async grantPurchase(
    input: PurchaseGrant,
    clock: WalletClock,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<{ applied: boolean; balance: number; expiresAt: Date | null } | Stale> {
    const manager = sharedContext.transactionManager as Executor
    const credits = wholeCredits(input.credits, 1)
    if (input.grantRef.trim() === "" || input.actor.trim() === "") {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "cp.ai_credit_grant_invalid")
    }
    const wallet = await this.touch(manager, input.tenantId, clock)
    if (isStale(wallet)) {
      return STALE
    }
    const written = await rowsOf<{ id: string }>(
      manager,
      `INSERT INTO ai_credit_entry
         (id, tenant_id, kind, amount, bucket, grant_ref, note, actor, created_at, updated_at)
       VALUES (?, ?, 'grant_purchase', ?, 'purchased', ?, ?, ?, ?, ?)
       ON CONFLICT (grant_ref) WHERE grant_ref IS NOT NULL AND deleted_at IS NULL DO NOTHING
       RETURNING id`,
      [
        generateEntityId(undefined, "aient"),
        input.tenantId,
        credits,
        input.grantRef,
        input.note ?? null,
        input.actor,
        clock.now,
        clock.now,
      ]
    )
    if (written.length === 0) {
      return {
        applied: false,
        balance: wallet.purchased_balance,
        expiresAt: wallet.purchased_expires_at,
      }
    }
    const [after] = await rowsOf<WalletRow>(
      manager,
      `UPDATE ai_credit_wallet
          SET purchased_balance = purchased_balance + ?, purchased_expires_at = ?, updated_at = now()
        WHERE tenant_id = ? AND deleted_at IS NULL
        RETURNING ${WALLET_COLUMNS}`,
      [credits, addMonths(clock.now, AI_PURCHASED_LIFETIME_MONTHS), input.tenantId]
    )
    if (!after) {
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "cp.ai_credit_wallet_missing")
    }
    return {
      applied: true,
      balance: after.purchased_balance,
      expiresAt: after.purchased_expires_at,
    }
  }

  /**
   * A staff correction (adr/0085 "Güvenlik"): credits added to or taken
   * from one bucket, with a note. A balance never goes below 0: the
   * statement holds only while it stays at 0 or more (else
   * `cp.ai_credit_balance_short`, nothing changes). Bought credits added
   * to a bucket without a live day get the top-up's life.
   */
  @InjectTransactionManager()
  async adjust(
    input: Adjustment,
    clock: WalletClock,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<{ entryId: string; balance: number } | Stale> {
    const manager = sharedContext.transactionManager as Executor
    if (!Number.isSafeInteger(input.amount) || input.amount === 0) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "cp.ai_credit_amount_invalid")
    }
    wholeCredits(Math.abs(input.amount), 1)
    if (input.note.trim() === "") {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "cp.ai_credit_note_required")
    }
    if (input.actor.trim() === "") {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "cp.ai_credit_actor_required")
    }
    if (!(AI_CREDIT_BUCKETS as readonly string[]).includes(input.bucket)) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "cp.ai_credit_bucket_invalid")
    }
    if ((await this.touch(manager, input.tenantId, clock)) === STALE) {
      return STALE
    }
    // The column is one of two fixed names, never the caller's text
    const column = input.bucket === "plan" ? "plan_balance" : "purchased_balance"
    const life =
      input.bucket === "purchased" && input.amount > 0
        ? `, purchased_expires_at = CASE WHEN purchased_expires_at IS NULL
             OR purchased_expires_at <= ? THEN ? ELSE purchased_expires_at END`
        : ""
    const lifeParams =
      life === "" ? [] : [clock.now, addMonths(clock.now, AI_PURCHASED_LIFETIME_MONTHS)]
    const [after] = await rowsOf<{ balance: number }>(
      manager,
      `UPDATE ai_credit_wallet SET ${column} = ${column} + ?${life}, updated_at = now()
        WHERE tenant_id = ? AND deleted_at IS NULL AND ${column} + ? >= 0
        RETURNING ${column} AS balance`,
      [input.amount, ...lifeParams, input.tenantId, input.amount]
    )
    if (!after) {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "cp.ai_credit_balance_short")
    }
    const [entryId] = await addEntries(manager, [
      {
        tenantId: input.tenantId,
        kind: "adjust",
        amount: input.amount,
        bucket: input.bucket,
        note: input.note.trim(),
        actor: input.actor,
        at: clock.now,
      },
    ])
    if (entryId === undefined) {
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "cp.ai_credit_entry_missing")
    }
    return { entryId, balance: after.balance }
  }
}
