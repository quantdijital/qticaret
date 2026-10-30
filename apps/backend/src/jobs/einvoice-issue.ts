import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { errorSummary, logger } from "../lib/logging"
import { notificationText } from "../lib/notifications/messages"
import { EINVOICE_MODULE } from "../modules/einvoice"
import type EinvoiceModuleService from "../modules/einvoice/service"
import { advanceInvoiceWorkflow } from "../workflows/einvoice/advance-invoice"
import { alertReturnNeeded } from "../workflows/einvoice/cancel-invoice"
import { orderOf, queueSaleInvoice } from "../workflows/einvoice/queue-invoices"

// Invoices moved on per run at most; the next run takes the rest
const BATCH = 20
// A run takes no more after this: inside the minute between runs
const RUN_BUDGET_MS = 50_000
// How far back the hourly sweep looks: a day, and some
const SWEEP_HOURS = 26
const SWEEP_LIMIT = 500

/** Tells every admin, in the panel's bell, that an invoice will not be tried again on its own (KK2). */
async function alertStopped(
  container: MedusaContainer,
  invoiceId: string,
  orderId: string,
  code: string
) {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: ["display_id"],
    filters: { id: orderId },
  })
  const order = String((data[0] as { display_id?: number } | undefined)?.display_id ?? "")
  await container
    .resolve(Modules.NOTIFICATION)
    .createNotifications({
      to: "",
      channel: "feed",
      template: "admin-ui",
      trigger_type: "einvoice.issue_stopped",
      resource_id: invoiceId,
      data: {
        kind: "einvoice_stopped",
        order_id: orderId,
        display_id: order,
        code,
        ...notificationText("einvoice.issue_stopped", { order }),
      },
    })
    .catch((error: unknown) => {
      logger.warn({ event: "einvoice.alert_failed", err: errorSummary(error) })
    })
}

/**
 * Moves the invoices due on at their program (F8, adr/0034 §7): each
 * claimed as it is worked on, through its workflow. One that fails is
 * tried again later and later; after the last try (or at once, when its
 * outcome is not known) it stops and rings the bell.
 */
export async function issueInvoices(container: MedusaContainer, now: Date = new Date()) {
  const counts = { moved: 0, issued: 0, stopped: 0 }
  const invoices = container.resolve<EinvoiceModuleService>(EINVOICE_MODULE)
  const started = Date.now()
  const at = () => new Date(now.getTime() + (Date.now() - started))
  for (let n = 0; n < BATCH && Date.now() - started < RUN_BUDGET_MS; n++) {
    const [row] = await invoices.claimDue(1, at())
    if (!row) {
      break
    }
    const { result } = await advanceInvoiceWorkflow(container).run({
      input: { invoice_id: row.id, lease: row.lease.toISOString() },
    })
    counts.moved += 1
    if (result.status === "issued") {
      counts.issued += 1
    }
    if (result.code === "einvoice.return_document_needed") {
      await alertReturnNeeded(container, row.id, row.order_id)
    }
    if (result.status === "failed") {
      counts.stopped += 1
      await alertStopped(container, row.id, row.order_id, result.code ?? "einvoice.error")
    }
  }
  return counts
}

/**
 * Queues the invoices of the last day that no event queued: parcels that
 * left, orders placed, payments taken (a transfer confirmed). Those
 * already queued, or not due by the shop's setting, are left alone.
 */
export async function sweepInvoices(container: MedusaContainer, now: Date = new Date()) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const since = new Date(now.getTime() - SWEEP_HOURS * 3_600_000)
  const window = { $gte: since, $lte: now }
  const page = { take: SWEEP_LIMIT }
  const [parcels, orders, payments] = await Promise.all([
    query.graph({
      entity: "fulfillment",
      fields: ["id"],
      filters: { shipped_at: window },
      pagination: page,
    }),
    query.graph({
      entity: "order",
      fields: ["id"],
      filters: { created_at: window },
      pagination: page,
    }),
    query.graph({
      entity: "payment",
      fields: ["id"],
      filters: { captured_at: window },
      pagination: page,
    }),
  ])
  let queued = 0
  const queue = async (orderId: string | null, moment: "placed" | "paid" | "shipped") => {
    if (orderId && (await queueSaleInvoice(container, orderId, moment)) === "queued") {
      queued += 1
    }
  }
  for (const row of parcels.data as { id: string }[]) {
    await queue(await orderOf(container, "fulfillment", row.id), "shipped")
  }
  for (const row of orders.data as { id: string }[]) {
    await queue(row.id, "placed")
  }
  for (const row of payments.data as { id: string }[]) {
    await queue(await orderOf(container, "payment", row.id), "paid")
  }
  return queued
}

export default async function einvoiceIssue(container: MedusaContainer) {
  const now = new Date()
  // The first run of each hour sweeps for what events missed
  if (now.getUTCMinutes() === 0) {
    try {
      const queued = await sweepInvoices(container, now)
      if (queued > 0) {
        logger.info({ event: "einvoice.swept", queued })
      }
    } catch (error) {
      logger.warn({ event: "einvoice.sweep_failed", err: errorSummary(error) })
    }
  }
  const counts = await issueInvoices(container, now)
  if (counts.moved > 0) {
    logger.info({ event: "einvoice.issued", ...counts })
  }
}

export const config = {
  name: "einvoice-issue",
  schedule: "* * * * *",
}
