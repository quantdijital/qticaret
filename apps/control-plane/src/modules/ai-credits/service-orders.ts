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
import { ID_MAX, REFERENCE_MAX, movedCredits, optionalLine, requiredLine } from "./inputs"
import { StaleWallet, isStale, rowsOf } from "./sql"
import type { Executor, Stale, WalletClock } from "./sql"
import { AiCreditClosing } from "./service-closing"

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

const orderNotFound = () =>
  new MedusaError(MedusaError.Types.NOT_FOUND, "cp.ai_credit_order_not_found")

const orderClosed = () => new MedusaError(MedusaError.Types.CONFLICT, "cp.ai_credit_order_closed")

// The transaction's connection when there is one: a read inside a change sees what it wrote
const executorOf = (sharedContext: Context): Executor =>
  (sharedContext.transactionManager ?? sharedContext.manager) as Executor

/**
 * The top-up requests (K11). A shop's own reads and cancels name the shop
 * (`orderOf`, `cancelOrder`: another shop's request is not found); the
 * staff's name only the request and say so (`orderAsStaff`,
 * `cancelOrderAsStaff`, `markOrderPaid`).
 */
export class AiCreditOrders extends AiCreditClosing {
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
    // A pack that could never be paid is refused when asked for, not when paid
    movedCredits(valid.credits)
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
        optionalLine(requestedBy, ID_MAX, "requested_by"),
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

  /** A shop's own request; another shop's is `cp.ai_credit_order_not_found`. */
  @InjectManager()
  async orderOf(
    tenantId: string,
    orderId: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<AiCreditOrderRow> {
    return await this.readOrder(executorOf(sharedContext), orderId, tenantId)
  }

  /** Any shop's request, for the staff's screens (P6: behind their roles). */
  @InjectManager()
  async orderAsStaff(
    orderId: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<AiCreditOrderRow> {
    return await this.readOrder(executorOf(sharedContext), orderId, null)
  }

  /**
   * A pending request marked paid by staff and its credits added, in one
   * transaction (`grant_ref` `order:<id>`, which no other path may write).
   * Marked twice, or twice at once, it adds once: the second finds it paid
   * (`applied: false`). A cancelled request cannot be paid
   * (`cp.ai_credit_order_closed`). Whatever fails after the mark (the
   * grant included) rolls the mark back: the request stays pending.
   */
  @InjectTransactionManager()
  async markOrderPaid(
    orderId: string,
    payment: OrderPayment,
    clock: WalletClock,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<{ applied: boolean; order: AiCreditOrderRow } | Stale> {
    const manager = sharedContext.transactionManager as Executor
    const actor = requiredLine(payment.actor, ID_MAX, "actor")
    const reference = optionalLine(payment.reference, REFERENCE_MAX, "reference")
    const [paid] = await rowsOf<AiCreditOrderRow>(
      manager,
      `UPDATE ai_credit_order SET status = 'paid', method = ?, reference = ?, decided_by = ?,
              decided_at = ?, updated_at = now()
        WHERE id = ? AND status = 'pending' AND deleted_at IS NULL
        RETURNING ${ORDER_COLUMNS}`,
      [payment.method, reference, actor, clock.now, orderId]
    )
    if (!paid) {
      const order = await this.readOrder(manager, orderId, null)
      if (order.status === "paid") {
        return { applied: false, order }
      }
      throw orderClosed()
    }
    const granted = await this.addPurchase(
      manager,
      {
        tenantId: paid.tenant_id,
        credits: paid.credits,
        grantRef: `order:${paid.id}`,
        actor,
        note: `${paid.pack_id} ${paid.pack_name}`,
      },
      clock
    )
    if (isStale(granted)) {
      // Thrown, so the order goes back to pending; the caller tries again with the grant
      throw new StaleWallet()
    }
    return { applied: granted.applied, order: paid }
  }

  /** A shop cancels its own pending request; any other is `cp.ai_credit_order_closed`. */
  @InjectTransactionManager()
  async cancelOrder(
    tenantId: string,
    orderId: string,
    actor: string,
    now: Date,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<AiCreditOrderRow> {
    return await this.closeOrder(
      sharedContext.transactionManager as Executor,
      orderId,
      tenantId,
      actor,
      now
    )
  }

  /** Staff cancel any shop's pending request; any other is `cp.ai_credit_order_closed`. */
  @InjectTransactionManager()
  async cancelOrderAsStaff(
    orderId: string,
    actor: string,
    now: Date,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<AiCreditOrderRow> {
    return await this.closeOrder(
      sharedContext.transactionManager as Executor,
      orderId,
      null,
      actor,
      now
    )
  }

  private async closeOrder(
    manager: Executor,
    orderId: string,
    tenantId: string | null,
    actor: string,
    now: Date
  ): Promise<AiCreditOrderRow> {
    const decidedBy = requiredLine(actor, ID_MAX, "actor")
    const [row] = await rowsOf<AiCreditOrderRow>(
      manager,
      `UPDATE ai_credit_order SET status = 'cancelled', decided_by = ?, decided_at = ?, updated_at = now()
        WHERE id = ? AND status = 'pending' AND deleted_at IS NULL
          AND (?::text IS NULL OR tenant_id = ?)
        RETURNING ${ORDER_COLUMNS}`,
      [decidedBy, now, orderId, tenantId, tenantId]
    )
    if (!row) {
      await this.readOrder(manager, orderId, tenantId)
      throw orderClosed()
    }
    return row
  }

  private async readOrder(
    executor: Executor,
    orderId: string,
    tenantId: string | null
  ): Promise<AiCreditOrderRow> {
    const [row] = await rowsOf<AiCreditOrderRow>(
      executor,
      `SELECT ${ORDER_COLUMNS} FROM ai_credit_order
        WHERE id = ? AND deleted_at IS NULL AND (?::text IS NULL OR tenant_id = ?)`,
      [orderId, tenantId, tenantId]
    )
    if (!row) {
      throw orderNotFound()
    }
    return row
  }
}
