import type { Context } from "@medusajs/framework/types"
import {
  InjectManager,
  InjectTransactionManager,
  MedusaContext,
  MedusaError,
  generateEntityId,
} from "@medusajs/framework/utils"
import type { ReminderKind } from "@qticaret/types/control-plane"
import { omit } from "../../lib/omit"
import type { ReminderOutcome } from "./models/reminder"
import { BillingSubscriptions } from "./service-subscriptions"
import { CHARGE_FIELDS, REMINDER_FIELDS } from "./types"
import type {
  ChargeChange,
  ChargeRecord,
  PaymentsFilter,
  ReminderRecord,
  SubscriptionRecord,
} from "./types"

interface Executor {
  execute: (sql: string, params: unknown[]) => Promise<unknown>
}

/** One `?` per value: the driver binds each, never a list spliced in. */
const placeholders = (values: readonly unknown[]) => values.map(() => "?").join(", ")

export interface PaymentRow extends ChargeRecord {
  grace_days: number
  subscription_status: SubscriptionRecord["status"]
}

/**
 * The control plane's billing (adr/0061 §2 `billing`, §7, Ek C16):
 * subscriptions and charges (service-subscriptions.ts), what staff do to
 * a charge, the reminders' once-only claims, the platform's payment
 * instruction and the payments lists.
 */
class BillingModuleService extends BillingSubscriptions {
  /**
   * A staff change to an open charge (Ek C16): paid (day, method,
   * reference), waived or voided (reason), its amount corrected (reason).
   * Only an open charge changes (409 `cp.charge_not_open`); the charge as
   * it was comes back to undo it.
   */
  @InjectTransactionManager()
  async changeCharge(
    tenantId: string,
    chargeId: string,
    change: ChargeChange,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<ChargeRecord> {
    await (sharedContext.transactionManager as Executor).execute(
      "SELECT id FROM charge WHERE id = ? AND tenant_id = ? FOR UPDATE",
      [chargeId, tenantId]
    )
    const before = await this.chargeOf(tenantId, chargeId, sharedContext)
    if (before.status !== "open") {
      throw new MedusaError(MedusaError.Types.CONFLICT, "cp.charge_not_open")
    }
    const settled = { settled_by: change.actor, settled_at: new Date() }
    const data =
      change.kind === "pay"
        ? {
            status: "paid" as const,
            paid_on: change.paid_on,
            method: change.method,
            reference: change.reference,
            ...settled,
          }
        : change.kind === "amount"
          ? { amount: change.amount, amount_reason: change.reason }
          : {
              status: change.kind === "waive" ? ("waived" as const) : ("void" as const),
              settle_reason: change.reason,
              ...settled,
            }
    await this.updateCharges({ id: chargeId, ...data }, sharedContext)
    return before
  }

  /** A charge put back as it was (a step's undo). */
  @InjectTransactionManager()
  async restoreCharge(
    before: ChargeRecord,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    await this.updateCharges(
      omit(before, "subscription_id", "tenant_id", "created_at") as unknown as { id: string },
      sharedContext
    )
  }

  /**
   * The claim on one reminder (insert first, Ek C16): true only for the
   * one caller whose row went in. Two runs, or two processes, at once: one
   * sends, the other finds the row and does not.
   */
  @InjectTransactionManager()
  async claimReminder(
    chargeId: string,
    tenantId: string,
    kind: ReminderKind,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<string | null> {
    const rows = (await (sharedContext.transactionManager as Executor).execute(
      `INSERT INTO reminder (id, charge_id, tenant_id, kind, channel, outcome, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'email', 'pending', now(), now())
       ON CONFLICT (charge_id, kind) WHERE deleted_at IS NULL DO NOTHING
       RETURNING id`,
      [generateEntityId(undefined, "rem"), chargeId, tenantId, kind]
    )) as { id: string }[]
    return rows[0]?.id ?? null
  }

  @InjectTransactionManager()
  async noteReminder(
    id: string,
    outcome: Exclude<ReminderOutcome, "pending">,
    errorCode: string | null,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    await this.updateReminders(
      {
        id,
        outcome,
        error_code: errorCode,
        sent_at: outcome === "sent" ? new Date() : null,
      },
      sharedContext
    )
  }

  @InjectManager()
  async remindersOf(
    tenantId: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<ReminderRecord[]> {
    return await this.listReminders(
      { tenant_id: tenantId },
      { select: [...REMINDER_FIELDS], order: { created_at: "DESC" }, take: 200 },
      sharedContext
    )
  }

  /** The platform's payment instruction; null when none is set. */
  @InjectManager()
  async paymentInstruction(@MedusaContext() sharedContext: Context = {}) {
    const [row] = await this.listBillingSettings(
      { key: "payment_instruction" },
      { select: ["value", "updated_by", "updated_at"], take: 1 },
      sharedContext
    )
    const found = row as
      { value: string | null; updated_by: string | null; updated_at: Date } | undefined
    return found
      ? { value: found.value, updated_by: found.updated_by, updated_at: found.updated_at }
      : { value: null, updated_by: null, updated_at: null }
  }

  /** The instruction set (null clears it); the one before comes back. */
  @InjectTransactionManager()
  async setPaymentInstruction(
    value: string | null,
    actor: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<string | null> {
    const [row] = await this.listBillingSettings(
      { key: "payment_instruction" },
      { select: ["id", "value"], take: 1 },
      sharedContext
    )
    if (row) {
      await this.updateBillingSettings({ id: row.id, value, updated_by: actor }, sharedContext)
    } else {
      await this.createBillingSettings(
        [{ key: "payment_instruction", value, updated_by: actor }],
        sharedContext
      )
    }
    return (row as { value: string | null } | undefined)?.value ?? null
  }

  /**
   * The payments screen's list (Ek C16): `upcoming` (open, due today or
   * later), `overdue` (open, past its day) or `paid` (paid or waived), with
   * their count and total, optionally for some shops and between two days.
   */
  @InjectManager()
  async payments(
    filter: PaymentsFilter,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<{ rows: PaymentRow[]; count: number; total: number }> {
    const where: string[] = ["c.deleted_at IS NULL"]
    const params: unknown[] = []
    const day = filter.view === "paid" ? "c.paid_on" : "c.due_on"
    if (filter.view === "paid") {
      where.push("c.status IN ('paid', 'waived')")
    } else {
      where.push("c.status = 'open'", filter.view === "upcoming" ? "c.due_on >= ?" : "c.due_on < ?")
      params.push(filter.today)
    }
    if (filter.tenant_id) {
      if (filter.tenant_id.length === 0) {
        return { rows: [], count: 0, total: 0 }
      }
      where.push(`c.tenant_id IN (${placeholders(filter.tenant_id)})`)
      params.push(...filter.tenant_id)
    }
    if (filter.from) {
      where.push(`${day} >= ?`)
      params.push(filter.from)
    }
    if (filter.to) {
      where.push(`${day} <= ?`)
      params.push(filter.to)
    }
    const from = `FROM charge c JOIN subscription s ON s.id = c.subscription_id AND s.deleted_at IS NULL
      WHERE ${where.join(" AND ")}`
    const manager = sharedContext.manager as Executor
    const [totals] = (await manager.execute(
      `SELECT count(*)::int AS count, coalesce(sum(c.amount), 0)::bigint AS total ${from}`,
      params
    )) as { count: number; total: string }[]
    const order = filter.view === "paid" ? "c.paid_on DESC, c.id DESC" : "c.due_on ASC, c.id ASC"
    const rows = (await manager.execute(
      `SELECT ${CHARGE_FIELDS.map((field) => `c.${field}`).join(", ")},
        coalesce(s.grace_days_override, s.grace_days) AS grace_days,
        s.status AS subscription_status
       ${from} ORDER BY ${order} LIMIT ? OFFSET ?`,
      [...params, filter.limit, filter.offset]
    )) as PaymentRow[]
    return { rows, count: totals?.count ?? 0, total: Number(totals?.total ?? 0) }
  }

  /**
   * Each shop's next payment day (the list's column, Ek C16): its oldest
   * open charge's day, else the next period's first day.
   */
  @InjectManager()
  async nextPayments(
    tenantIds: readonly string[],
    @MedusaContext() sharedContext: Context = {}
  ): Promise<Map<string, string>> {
    if (tenantIds.length === 0) {
      return new Map()
    }
    const rows = (await (sharedContext.manager as Executor).execute(
      `SELECT s.tenant_id,
          coalesce((SELECT min(c.due_on) FROM charge c WHERE c.subscription_id = s.id
                      AND c.status = 'open' AND c.deleted_at IS NULL), s.current_period_end) AS next_on
        FROM subscription s WHERE s.deleted_at IS NULL AND s.tenant_id IN (${placeholders(tenantIds)})`,
      [...tenantIds]
    )) as { tenant_id: string; next_on: string }[]
    return new Map(rows.map((row) => [row.tenant_id, row.next_on]))
  }
}

export default BillingModuleService
