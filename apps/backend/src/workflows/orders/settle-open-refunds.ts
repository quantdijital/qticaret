import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { errorSummary, logger } from "../../lib/logging"
import { kurus } from "../../lib/money"
import { isCancelRefundReference, orderRefundLockKey } from "../../lib/orders/locks"
import { ORDER_REFUNDS_MODULE } from "../../modules/order-refunds"
import type OrderRefundsModuleService from "../../modules/order-refunds/service"
import { alertPaymentIssue } from "../payments/issue-alert"
import { refundOrderWorkflow } from "./refund-order"
import {
  ENTRY_FIELDS,
  PROVIDER_REFUSED,
  REFUND_INCOMPLETE,
  REFUND_UNCONFIRMED,
  UNSETTLED,
  checkedCodeOf,
  tracedOf,
} from "./refund-settle"
import type { LedgerEntry } from "./refund-settle"
import { refundTraceOf } from "./refund-trace"

// An entry this fresh may be a refund under way: left to the next round
const QUIET_MS = 2 * 60 * 1000
// An entry no failure marked, this long past the refund lock's TTL (10 min): a crash left it
export const STRANDED_MS = 20 * 60 * 1000
// PayTR's record can lag a lost answer: shown nothing twice this far apart, it was never made
export const CONFIRM_MS = 15 * 60 * 1000
// Still open this long after it was opened: the shop looks (the alert says so)
export const ESCALATE_MS = 60 * 60 * 1000
const PAGE = 100
// Pages one round reads at most, by id: every open entry is reached, none read twice (D-5)
const MAX_PAGES = 20

type Entry = LedgerEntry & { error_code: string | null; created_at: Date; updated_at: Date }

export interface SettleRound {
  closed: number
  failed: number
  open: number
}

const timeOf = (value: Date | string) => new Date(value).getTime()

/**
 * Changes an entry's state under the order's refund lock, while it is still
 * the one read: pending, same code, not written since (review D-1).
 */
async function mark(
  container: MedusaContainer,
  entry: Entry,
  change: { status: "pending" | "failed"; error_code: string }
): Promise<void> {
  const ledger = container.resolve<OrderRefundsModuleService>(ORDER_REFUNDS_MODULE)
  await container.resolve(Modules.LOCKING).execute(
    orderRefundLockKey(entry.order_id),
    async () => {
      const [now] = await ledger.listOrderRefunds(
        { id: entry.id },
        { select: ["id", "status", "error_code", "updated_at"] }
      )
      const same =
        now?.status === "pending" &&
        now.error_code === entry.error_code &&
        timeOf(now.updated_at) === timeOf(entry.updated_at)
      if (same) {
        await ledger.updateOrderRefunds({ id: entry.id, ...change })
      }
    },
    { timeout: 5 }
  )
}

/**
 * Whether closing this refund leaves an order to cancel: a cancel's refund
 * whose order is not canceled (the cancel stopped on it, review D4-5).
 * Read before the refund is closed: a read that fails then leaves it open
 * for the next round, never closed with the shop untold.
 */
async function uncanceledByCancel(container: MedusaContainer, entry: Entry): Promise<boolean> {
  if (!isCancelRefundReference(entry.reference)) {
    return false
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: ["status"],
    filters: { id: entry.order_id },
  })
  return (data[0] as { status?: string } | undefined)?.status !== "canceled"
}

/**
 * One open entry (review 2026-11-17, O1/O2). Its money surely back
 * (recorded, or shown by the provider): closed under its own reference,
 * nothing sent again. PayTR showing nothing: `refund_unconfirmed` on the
 * first read, `failed` (its lines free again) once shown nothing again
 * `CONFIRM_MS` later; elsewhere nothing shown is nothing sent. Unreadable,
 * or iyzico parts not all answered: marked `refund_incomplete` if a crash
 * left it unmarked, else left as it is; the shop told once it is
 * `ESCALATE_MS` old, and the shop's own check settles it.
 */
async function settleEntry(
  container: MedusaContainer,
  entry: Entry,
  now: number
): Promise<keyof SettleRound | "none"> {
  const { trace, provider } = await refundTraceOf(container, tracedOf(entry))
  if (trace === "made" || trace === "shown") {
    const orderOpen = await uncanceledByCancel(container, entry)
    const { result } = await refundOrderWorkflow(container).run({
      input: {
        order_id: entry.order_id,
        reference: entry.reference,
        request: { amount: kurus(entry.amount) },
        payment_id: entry.payment_id,
        close_only: true,
      },
    })
    // Closed meanwhile (by staff, under the lock): nothing done this round, nothing told (L2)
    if (result.closed_before) {
      return "none"
    }
    // The money is back, the goods must not go: the shop cancels the order (once per refund)
    if (orderOpen) {
      await alertPaymentIssue(container, {
        issue: "cancel_refund_order_open",
        provider,
        reference: entry.reference,
        cart_id: entry.order_id,
        amount: entry.amount,
      })
    }
    return "closed"
  }
  // Refused outright, its undoing cut short by a crash: nothing was made
  if (entry.error_code === PROVIDER_REFUSED && trace === "none") {
    await mark(container, entry, { status: "failed", error_code: "refund_failed" })
    return "failed"
  }
  if (trace === "none") {
    const confirmed =
      provider !== "paytr" ||
      (entry.error_code === REFUND_UNCONFIRMED && timeOf(entry.updated_at) <= now - CONFIRM_MS)
    if (confirmed) {
      await mark(container, entry, { status: "failed", error_code: "refund_failed" })
      return "failed"
    }
    if (entry.error_code !== REFUND_UNCONFIRMED) {
      await mark(container, entry, { status: "pending", error_code: REFUND_UNCONFIRMED })
    }
  } else if (
    !(UNSETTLED as readonly (string | null)[]).includes(entry.error_code) &&
    // A staff check's mark kept (L1): a cut check closed in part reads shown, never marked over
    !checkedCodeOf(entry.error_code)
  ) {
    await mark(container, entry, { status: "pending", error_code: REFUND_INCOMPLETE })
  }
  if (timeOf(entry.created_at) <= now - ESCALATE_MS) {
    await alertPaymentIssue(container, {
      issue: "refund_unresolved",
      provider,
      reference: entry.reference,
      cart_id: entry.order_id,
      amount: entry.amount,
    })
  }
  return "open"
}

// Marked unsettled by a failure: read soon; anything else pending (a crash left it): read once
// it is surely no refund under way
const settleable = (entry: Entry, now: number): boolean =>
  timeOf(entry.updated_at) <=
  now -
    ((UNSETTLED as readonly (string | null)[]).includes(entry.error_code) ? QUIET_MS : STRANDED_MS)

/**
 * Every open entry a failure marked unsettled, and every one a crash left
 * pending unmarked (O2), oldest id first; one failing never stops the rest.
 */
export async function settleOpenRefunds(
  container: MedusaContainer,
  now: number = Date.now()
): Promise<SettleRound> {
  const ledger = container.resolve<OrderRefundsModuleService>(ORDER_REFUNDS_MODULE)
  const round: SettleRound = { closed: 0, failed: 0, open: 0 }
  let after = ""
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const entries = (await ledger.listOrderRefunds(
      {
        status: "pending",
        updated_at: { $lt: new Date(now - QUIET_MS) },
        ...(after ? { id: { $gt: after } } : {}),
      },
      { select: ENTRY_FIELDS, take: PAGE, order: { id: "ASC" } }
    )) as unknown as Entry[]
    for (const entry of entries.filter((each) => settleable(each, now))) {
      try {
        const outcome = await settleEntry(container, entry, now)
        if (outcome !== "none") {
          round[outcome] += 1
        }
      } catch (error) {
        round.open += 1
        logger.warn({
          event: "orders.refund_settle_failed",
          reference: entry.reference,
          err: errorSummary(error),
        })
      }
    }
    const last = entries.at(-1)
    if (entries.length < PAGE || !last) {
      break
    }
    after = last.id
  }
  if (round.closed + round.failed + round.open > 0) {
    logger.info({ event: "orders.refund_settle", ...round })
  }
  return round
}
