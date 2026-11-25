import type { Context } from "@medusajs/framework/types"
import {
  InjectManager,
  InjectTransactionManager,
  MedusaContext,
  MedusaError,
  generateEntityId,
} from "@medusajs/framework/utils"
import { aiCreditPackSchema } from "@qticaret/types/control-plane"
import type { AiCreditPack, PaymentMethod } from "@qticaret/types/control-plane"
import { isStale, rowsOf } from "./sql"
import type { Executor, Stale, WalletClock } from "./sql"
import { AiCreditOperations } from "./service-operations"

export interface AiCreditOrderRow {
  id: string
  tenant_id: string
  pack_id: string
  pack_name: string
  credits: number
  amount: number
  currency: string
  status: "pending" | "paid" | "cancelled"
  method: PaymentMethod | null
  reference: string | null
  requested_by: string | null
  decided_by: string | null
  requested_at: Date
  decided_at: Date | null
}

const ORDER_COLUMNS = `id, tenant_id, pack_id, pack_name, credits, amount, currency, status, method,
  reference, requested_by, decided_by, requested_at, decided_at`

export interface OrderPayment {
  actor: string
  method: PaymentMethod
  reference?: string | null
}

/** A shop's ledger and wallet that do not agree (the reconcile job's finding). */
export interface LedgerMismatch {
  tenant_id: string
  wallet: { plan: number; purchased: number }
  ledger: { plan: number; purchased: number }
}

// No parameters: a call with the generated writer's arguments does not
// compile, and one that gets past the types still throws
function refuseWrite(): never {
  throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "cp.ai_credit_write_refused")
}

const orderNotFound = () =>
  new MedusaError(MedusaError.Types.NOT_FOUND, "cp.ai_credit_order_not_found")

/**
 * The AI platform credits (adr/0085 §1): wallets, the append-only ledger,
 * the charged operations and the top-up requests. Every change goes
 * through the methods here (service-wallet.ts, service-operations.ts),
 * each one transaction with conditional statements; the generated writers
 * are closed.
 */
class AiCreditsModuleService extends AiCreditOperations {
  /**
   * A top-up asked for (K11): the pack as it is now, copied. A shop with a
   * request still pending gets `cp.ai_credit_order_pending` (the partial
   * unique index decides, also for two at once).
   */
  @InjectTransactionManager()
  async requestOrder(
    tenantId: string,
    pack: AiCreditPack,
    requestedBy: string | null,
    now: Date,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<AiCreditOrderRow> {
    const valid = aiCreditPackSchema.parse(pack)
    const [row] = await rowsOf<AiCreditOrderRow>(
      sharedContext.transactionManager as Executor,
      `INSERT INTO ai_credit_order
         (id, tenant_id, pack_id, pack_name, credits, amount, currency, status, requested_by,
          requested_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)
       ON CONFLICT (tenant_id) WHERE status = 'pending' AND deleted_at IS NULL DO NOTHING
       RETURNING ${ORDER_COLUMNS}`,
      [
        generateEntityId(undefined, "aiord"),
        tenantId,
        valid.id,
        valid.name,
        valid.credits,
        valid.amount,
        valid.currency,
        requestedBy?.slice(0, 256) ?? null,
        now,
        now,
        now,
      ]
    )
    if (!row) {
      throw new MedusaError(MedusaError.Types.CONFLICT, "cp.ai_credit_order_pending")
    }
    return row
  }

  @InjectManager()
  async orderOf(
    orderId: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<AiCreditOrderRow> {
    const [row] = await rowsOf<AiCreditOrderRow>(
      sharedContext.manager as Executor,
      `SELECT ${ORDER_COLUMNS} FROM ai_credit_order WHERE id = ? AND deleted_at IS NULL`,
      [orderId]
    )
    if (!row) {
      throw orderNotFound()
    }
    return row
  }

  /**
   * A pending request marked paid and its credits added, in one
   * transaction (`grant_ref` `order:<id>`). Marked twice, or twice at
   * once, it adds once: the second finds it paid (`applied: false`). A
   * cancelled request cannot be paid (`cp.ai_credit_order_closed`).
   */
  @InjectTransactionManager()
  async markOrderPaid(
    orderId: string,
    payment: OrderPayment,
    clock: WalletClock,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<{ applied: boolean; order: AiCreditOrderRow } | Stale> {
    const manager = sharedContext.transactionManager as Executor
    if (payment.actor.trim() === "") {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "cp.ai_credit_actor_required")
    }
    const [paid] = await rowsOf<AiCreditOrderRow>(
      manager,
      `UPDATE ai_credit_order SET status = 'paid', method = ?, reference = ?, decided_by = ?,
              decided_at = ?, updated_at = now()
        WHERE id = ? AND status = 'pending' AND deleted_at IS NULL
        RETURNING ${ORDER_COLUMNS}`,
      [payment.method, payment.reference?.slice(0, 256) ?? null, payment.actor, clock.now, orderId]
    )
    if (!paid) {
      const order = await this.orderOf(orderId, sharedContext)
      if (order.status === "paid") {
        return { applied: false, order }
      }
      throw new MedusaError(MedusaError.Types.CONFLICT, "cp.ai_credit_order_closed")
    }
    const granted = await this.grantPurchase(
      {
        tenantId: paid.tenant_id,
        credits: paid.credits,
        grantRef: `order:${paid.id}`,
        actor: payment.actor,
        note: `${paid.pack_id} ${paid.pack_name}`.slice(0, 256),
      },
      clock,
      sharedContext
    )
    if (isStale(granted)) {
      // Thrown, so the order goes back to pending; the caller tries again with the grant
      throw new StaleWallet()
    }
    return { applied: granted.applied, order: paid }
  }

  /** A pending request cancelled; any other is `cp.ai_credit_order_closed`. */
  @InjectTransactionManager()
  async cancelOrder(
    orderId: string,
    actor: string,
    now: Date,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<AiCreditOrderRow> {
    const [row] = await rowsOf<AiCreditOrderRow>(
      sharedContext.transactionManager as Executor,
      `UPDATE ai_credit_order SET status = 'cancelled', decided_by = ?, decided_at = ?, updated_at = now()
        WHERE id = ? AND status = 'pending' AND deleted_at IS NULL
        RETURNING ${ORDER_COLUMNS}`,
      [actor, now, orderId]
    )
    if (!row) {
      await this.orderOf(orderId, sharedContext)
      throw new MedusaError(MedusaError.Types.CONFLICT, "cp.ai_credit_order_closed")
    }
    return row
  }

  /**
   * Every shop whose ledger does not add up to its wallet, bucket by
   * bucket. One statement, so one snapshot: a change commits its wallet and
   * its rows together and is seen whole or not at all.
   */
  @InjectManager()
  async ledgerMismatches(@MedusaContext() sharedContext: Context = {}): Promise<LedgerMismatch[]> {
    const rows = await rowsOf<{
      tenant_id: string
      // Text: a ledger's sum is a bigint, which the driver hands back as a string
      wallet_plan: string
      wallet_purchased: string
      ledger_plan: string
      ledger_purchased: string
    }>(
      sharedContext.manager as Executor,
      `WITH sums AS (
         SELECT tenant_id,
                COALESCE(SUM(amount) FILTER (WHERE bucket = 'plan'), 0)::bigint AS plan,
                COALESCE(SUM(amount) FILTER (WHERE bucket = 'purchased'), 0)::bigint AS purchased
           FROM ai_credit_entry WHERE deleted_at IS NULL GROUP BY tenant_id
       ), wallets AS (
         SELECT tenant_id, plan_balance, purchased_balance
           FROM ai_credit_wallet WHERE deleted_at IS NULL
       )
       SELECT COALESCE(w.tenant_id, s.tenant_id) AS tenant_id,
              COALESCE(w.plan_balance, 0)::text AS wallet_plan,
              COALESCE(w.purchased_balance, 0)::text AS wallet_purchased,
              COALESCE(s.plan, 0)::text AS ledger_plan,
              COALESCE(s.purchased, 0)::text AS ledger_purchased
         FROM wallets w FULL OUTER JOIN sums s ON s.tenant_id = w.tenant_id
        WHERE COALESCE(w.plan_balance, 0) <> COALESCE(s.plan, 0)
           OR COALESCE(w.purchased_balance, 0) <> COALESCE(s.purchased, 0)
        ORDER BY 1
        LIMIT 1000`,
      []
    )
    return rows.map((row) => ({
      tenant_id: row.tenant_id,
      wallet: { plan: Number(row.wallet_plan), purchased: Number(row.wallet_purchased) },
      ledger: { plan: Number(row.ledger_plan), purchased: Number(row.ledger_purchased) },
    }))
  }

  // The generated writers stay unreachable: balances and ledger rows change
  // only through the methods above, each with its conditions and rows
  override createAiCreditWallets = refuseWrite
  override updateAiCreditWallets = refuseWrite
  override deleteAiCreditWallets = refuseWrite
  override softDeleteAiCreditWallets = refuseWrite
  override restoreAiCreditWallets = refuseWrite
  override createAiCreditEntries = refuseWrite
  override updateAiCreditEntries = refuseWrite
  override deleteAiCreditEntries = refuseWrite
  override softDeleteAiCreditEntries = refuseWrite
  override restoreAiCreditEntries = refuseWrite
  override createAiCreditOperations = refuseWrite
  override updateAiCreditOperations = refuseWrite
  override deleteAiCreditOperations = refuseWrite
  override softDeleteAiCreditOperations = refuseWrite
  override restoreAiCreditOperations = refuseWrite
  override createAiCreditOrders = refuseWrite
  override updateAiCreditOrders = refuseWrite
  override deleteAiCreditOrders = refuseWrite
  override softDeleteAiCreditOrders = refuseWrite
  override restoreAiCreditOrders = refuseWrite
}

/** Thrown inside a transaction whose wallet's month is behind, to roll it back; the caller retries. */
export class StaleWallet extends Error {
  constructor() {
    super("cp.ai_credit_wallet_stale")
    this.name = "StaleWallet"
  }
}

export default AiCreditsModuleService
