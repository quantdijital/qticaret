import type { Context } from "@medusajs/framework/types"
import { InjectTransactionManager, MedusaContext, MedusaError } from "@medusajs/framework/utils"
import { addMonths } from "../../lib/ai-credits/period"
import { AI_CREDIT_BUCKETS } from "./models/entry"
import type { AiCreditBucket } from "./models/entry"
import { ID_MAX, adjustRef, movedCredits, noteOf, purchaseRef, requiredLine } from "./inputs"
import { STALE, addGrantEntry, isStale, platformValues, rowsOf } from "./sql"
import type { Executor, Stale, WalletClock } from "./sql"
import { AiCreditWallets, WALLET_COLUMNS } from "./service-wallet"
import type { WalletRow } from "./service-wallet"

export interface PurchaseGrant {
  tenantId: string
  credits: number
  /**
   * Names the grant once: a staff top-up's own reference (`purchaseRef`:
   * never `plan:`, `adjust:` or `order:`, which the platform writes).
   */
  grantRef: string
  actor: string
  note?: string | null
}

export interface Adjustment {
  tenantId: string
  /** The caller's UUID for this correction: the same key twice corrects once. */
  key: string
  /** Signed: a staff member adds or takes credits. */
  amount: number
  bucket: AiCreditBucket
  note: string
  actor: string
}

export interface PurchaseResult {
  applied: boolean
  balance: number
  expiresAt: Date | null
}

/**
 * Credits put in by hand (adr/0085 K6, K11, "Güvenlik"): a top-up under
 * its own reference and a staff correction under its key, each once.
 */
export class AiCreditGrants extends AiCreditWallets {
  /**
   * Bought credits added once (K6, K11) under the caller's own reference
   * (`purchaseRef`: the platform's prefixes are refused). A reference
   * already written for the same top-up changes nothing (`applied:
   * false`), also when two arrive at once; written for another shop or
   * amount it is `cp.ai_credit_grant_ref_conflict`.
   */
  @InjectTransactionManager()
  async grantPurchase(
    input: PurchaseGrant,
    clock: WalletClock,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<PurchaseResult | Stale> {
    return await this.addPurchase(
      sharedContext.transactionManager as Executor,
      { ...input, grantRef: purchaseRef(input.grantRef) },
      clock
    )
  }

  /**
   * A top-up in the caller's transaction, its reference as given (a paid
   * request's `order:<id>` comes only through here). The ledger row goes
   * in first and its unique `grant_ref` decides (`addGrantEntry`). Every
   * top-up moves the whole bought balance's last day to now plus its life,
   * never earlier than it was.
   */
  protected async addPurchase(
    manager: Executor,
    input: PurchaseGrant,
    clock: WalletClock
  ): Promise<PurchaseResult | Stale> {
    const credits = movedCredits(input.credits)
    const actor = requiredLine(input.actor, ID_MAX, "actor")
    const note = noteOf(input.note, false)
    const wallet = await this.touch(manager, input.tenantId, clock)
    if (isStale(wallet)) {
      return STALE
    }
    const written = await addGrantEntry(manager, {
      tenantId: input.tenantId,
      kind: "grant_purchase",
      amount: credits,
      bucket: "purchased",
      grantRef: input.grantRef,
      note,
      actor,
      at: clock.now,
    })
    if (!written.applied) {
      return {
        applied: false,
        balance: wallet.purchased_balance,
        expiresAt: wallet.purchased_expires_at,
      }
    }
    const [after] = await rowsOf<WalletRow>(
      manager,
      `UPDATE ai_credit_wallet
          SET purchased_balance = purchased_balance + ?,
              purchased_expires_at = GREATEST(purchased_expires_at, ?), updated_at = now()
        WHERE tenant_id = ? AND deleted_at IS NULL
        RETURNING ${WALLET_COLUMNS}`,
      [
        credits,
        addMonths(clock.now, (await platformValues(manager)).lifetimeMonths),
        input.tenantId,
      ]
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
   * from one bucket, with a note, once per the caller's key (`grant_ref`
   * `adjust:<key>`: the same key again changes nothing and answers
   * `applied: false` with the first one's row). A balance never goes
   * below 0: the statement holds only while it stays at 0 or more (else
   * `cp.ai_credit_balance_short`, and the row goes back with it). Bought
   * credits added to a bucket without a live day get the top-up's life.
   */
  @InjectTransactionManager()
  async adjust(
    input: Adjustment,
    clock: WalletClock,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<{ applied: boolean; entryId: string; balance: number } | Stale> {
    const manager = sharedContext.transactionManager as Executor
    if (!Number.isSafeInteger(input.amount) || input.amount === 0) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "cp.ai_credit_amount_invalid")
    }
    movedCredits(Math.abs(input.amount))
    const grantRef = adjustRef(input.key)
    const note = noteOf(input.note, true)
    const actor = requiredLine(input.actor, ID_MAX, "actor")
    if (!(AI_CREDIT_BUCKETS as readonly string[]).includes(input.bucket)) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "cp.ai_credit_bucket_invalid")
    }
    const wallet = await this.touch(manager, input.tenantId, clock)
    if (isStale(wallet)) {
      return STALE
    }
    // The column is one of two fixed names, never the caller's text
    const column = input.bucket === "plan" ? "plan_balance" : "purchased_balance"
    const written = await addGrantEntry(manager, {
      tenantId: input.tenantId,
      kind: "adjust",
      amount: input.amount,
      bucket: input.bucket,
      grantRef,
      note,
      actor,
      at: clock.now,
    })
    if (!written.applied) {
      return { applied: false, entryId: written.id, balance: wallet[column] }
    }
    const life =
      input.bucket === "purchased" && input.amount > 0
        ? `, purchased_expires_at = CASE WHEN purchased_expires_at IS NULL
             OR purchased_expires_at <= ? THEN ? ELSE purchased_expires_at END`
        : ""
    const lifeParams =
      life === ""
        ? []
        : [clock.now, addMonths(clock.now, (await platformValues(manager)).lifetimeMonths)]
    const [after] = await rowsOf<{ balance: number }>(
      manager,
      `UPDATE ai_credit_wallet SET ${column} = ${column} + ?${life}, updated_at = now()
        WHERE tenant_id = ? AND deleted_at IS NULL AND ${column} + ? >= 0
        RETURNING ${column} AS balance`,
      [input.amount, ...lifeParams, input.tenantId, input.amount]
    )
    if (!after) {
      // Thrown: the transaction rolls back, the correction's row with it
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "cp.ai_credit_balance_short")
    }
    return { applied: true, entryId: written.id, balance: after.balance }
  }
}
