import type { Context } from "@medusajs/framework/types"
import {
  InjectManager,
  InjectTransactionManager,
  MedusaContext,
  MedusaService,
} from "@medusajs/framework/utils"
import { uniqueViolationKeys } from "../../lib/errors"
import { Invoice } from "./models/invoice"
import { ParasutConnection } from "./models/parasut-connection"
import type {
  DOCUMENT_TYPES,
  INVOICE_KINDS,
  INVOICE_PROVIDERS,
  INVOICE_STATUSES,
} from "./models/invoice"

export type InvoiceKind = (typeof INVOICE_KINDS)[number]
export type InvoiceProviderId = (typeof INVOICE_PROVIDERS)[number]
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number]
export type DocumentType = (typeof DOCUMENT_TYPES)[number]

export interface QueuedInvoice {
  order_id: string
  kind: InvoiceKind
  source_id: string
  provider: InvoiceProviderId
  totals: { net: string; vat: string; gross: string }
  original_invoice_id?: string | null
}

export interface ClaimedInvoice {
  id: string
  order_id: string
  kind: InvoiceKind
  source_id: string
  provider: InvoiceProviderId
  status: "pending" | "issuing"
  attempts: number
  external_id: string | null
  document_id: string | null
  job_id: string | null
  job_started_at: Date | null
  /** Until when this claim holds it: a change after another worker took it is refused. */
  lease: Date
}

/** What a step learned from the program, kept as it learns it. */
export interface InvoiceProgress {
  external_id?: string | null
  document_id?: string | null
  document_type?: DocumentType | null
  job_id?: string | null
  job_started_at?: Date | null
  /** Known before the PDF is ready: kept as soon as the program gives them. */
  number?: string | null
  uuid?: string | null
  cancellable_until?: Date | null
  program_difference?: number | null
}

export interface IssuedInvoice {
  number: string
  uuid: string | null
  document_type: DocumentType
  issued_at: Date
  cancellable_until: Date | null
  program_difference: number | null
  /** The PDF in the private store. */
  pdf_file_id?: string | null
}

interface Executor {
  execute: (sql: string, params: unknown[]) => Promise<unknown>
}

/** Tries before an invoice stops and staff are told (KK2). */
export const MAX_ATTEMPTS = 8
// Minutes to wait after each failed try: 1, 5, 15 minutes, then 1, 3, 6, 12 hours
const BACKOFF_MINUTES = [1, 5, 15, 60, 180, 360, 720]
// While a claimed invoice is worked on, no other worker takes it
const LEASE_MINUTES = 5
// How soon a program's job is asked about again
const POLL_MINUTES = 1

const minutesFrom = (now: Date, minutes: number) => new Date(now.getTime() + minutes * 60_000)

// The columns a settled claim may change; the rest are the record's own
const SETTLED = [
  "status",
  "attempts",
  "next_attempt_at",
  "last_error",
  "external_id",
  "document_id",
  "document_type",
  "job_id",
  "job_started_at",
  "number",
  "uuid",
  "issued_at",
  "cancellable_until",
  "program_difference",
  "pdf_file_id",
] as const
type Settled = Partial<Record<(typeof SETTLED)[number], unknown>>

/** Invoices for orders (F8, adr/0034 §2): queued once, worked on until issued or stopped. */
export class InvoiceQueueService extends MedusaService({ Invoice, ParasutConnection }) {
  /**
   * Queues an order's invoice; one already queued for the same order, kind
   * and source (any status) is returned as it is, so an event delivered
   * twice queues one invoice (KK3).
   */
  async enqueue(record: QueuedInvoice, now: Date = new Date()) {
    try {
      const created = await this.createInvoices({
        order_id: record.order_id,
        kind: record.kind,
        source_id: record.source_id,
        provider: record.provider,
        next_attempt_at: now,
        // Two decimals as text: a number reads them back exactly
        net_total: Number(record.totals.net),
        vat_total: Number(record.totals.vat),
        gross_total: Number(record.totals.gross),
        original_invoice_id: record.original_invoice_id ?? null,
      })
      return { id: created.id, created: true }
    } catch (error) {
      if (!uniqueViolationKeys(error)?.includes("order_id")) {
        throw error
      }
      const [existing] = await this.listInvoices(
        { order_id: record.order_id, kind: record.kind, source_id: record.source_id },
        { select: ["id"], take: 1 }
      )
      if (!existing) {
        throw error
      }
      return { id: existing.id, created: false }
    }
  }

  /**
   * Takes up to `limit` invoices due now, in one statement: two workers
   * never take the same one. An external program's are not taken (it
   * writes them back itself). A taken one is due again only after the
   * lease, should its worker die halfway.
   */
  @InjectTransactionManager()
  async claimDue(
    limit: number,
    now: Date = new Date(),
    @MedusaContext() sharedContext: Context = {}
  ): Promise<ClaimedInvoice[]> {
    const manager = sharedContext.transactionManager as Executor
    return (await manager.execute(
      `UPDATE invoice SET next_attempt_at = ?, updated_at = now()
        WHERE id IN (
          SELECT id FROM invoice
           WHERE status IN ('pending', 'issuing') AND provider <> 'external'
             AND next_attempt_at <= ? AND deleted_at IS NULL
           ORDER BY next_attempt_at, id LIMIT ?
           FOR UPDATE SKIP LOCKED)
        RETURNING id, order_id, kind, source_id, provider, status, attempts, external_id,
                  document_id, job_id, job_started_at, next_attempt_at AS lease`,
      [minutesFrom(now, LEASE_MINUTES), now, limit]
    )) as ClaimedInvoice[]
  }

  /**
   * Changes a claimed invoice only while the claim holds: a worker whose
   * lease ran out changes nothing. A kept claim moves its lease to the new
   * `next_attempt_at`. Whether it did.
   */
  @InjectTransactionManager()
  private async settle(
    row: ClaimedInvoice,
    changes: Settled,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<boolean> {
    const manager = sharedContext.transactionManager as Executor
    const keys = SETTLED.filter((key) => changes[key] !== undefined)
    const rows = (await manager.execute(
      `UPDATE invoice SET ${keys.map((key) => `${key} = ?`).join(", ")}, updated_at = now()
        WHERE id = ? AND status = ? AND next_attempt_at = ? AND deleted_at IS NULL
       RETURNING id`,
      [...keys.map((key) => changes[key]), row.id, row.status, row.lease]
    )) as unknown[]
    if (rows.length > 0 && changes.next_attempt_at instanceof Date) {
      row.lease = changes.next_attempt_at
    }
    if (rows.length > 0 && (changes.status === "pending" || changes.status === "issuing")) {
      row.status = changes.status
    }
    return rows.length > 0
  }

  /**
   * Keeps what the program made, the moment it made it: a try that stops
   * after this carries on from here. The claim stays held.
   */
  keep(row: ClaimedInvoice, progress: InvoiceProgress, now: Date = new Date()) {
    return this.settle(row, { ...progress, next_attempt_at: minutesFrom(now, LEASE_MINUTES) })
  }

  /** Started at the program: asked about again shortly. */
  markIssuing(row: ClaimedInvoice, progress: InvoiceProgress, now: Date = new Date()) {
    return this.settle(row, {
      ...progress,
      status: "issuing",
      last_error: null,
      next_attempt_at: minutesFrom(now, POLL_MINUTES),
    })
  }

  /** Still being issued: asked about again shortly; not a failed try. */
  markWaiting(row: ClaimedInvoice, now: Date = new Date()) {
    return this.settle(row, { next_attempt_at: minutesFrom(now, POLL_MINUTES) })
  }

  /** Issued: its number kept. */
  markIssued(row: ClaimedInvoice, issued: IssuedInvoice, now: Date = new Date()) {
    return this.settle(row, {
      ...issued,
      status: "issued",
      last_error: null,
      next_attempt_at: now,
    })
  }

  /**
   * One more failed try: later again, or stopped after the last. What the
   * program made so far stays, so the next try carries on from it. The
   * status it is left in, or null when the claim had run out.
   */
  async markFailed(
    row: ClaimedInvoice,
    code: string,
    now: Date = new Date(),
    options: { stop?: boolean } = {}
  ): Promise<InvoiceStatus | null> {
    const tried = row.attempts + 1
    // `stop`: not tried again on its own (an outcome not known: staff look first)
    const status = tried >= MAX_ATTEMPTS || options.stop ? "failed" : row.status
    const done = await this.settle(row, {
      status,
      attempts: tried,
      next_attempt_at: minutesFrom(now, BACKOFF_MINUTES[tried - 1] ?? 720),
      last_error: code.slice(0, 120),
    })
    return done ? status : null
  }

  /** Staff ask a stopped invoice to be tried again: it carries on from where it stopped. */
  async retry(id: string, now: Date = new Date()): Promise<boolean> {
    const [row] = await this.listInvoices({ id, status: "failed" }, { take: 1 })
    if (!row) {
      return false
    }
    await this.updateInvoices({
      id,
      status: row.job_id ? "issuing" : "pending",
      attempts: 0,
      next_attempt_at: now,
    })
    return true
  }

  /** How many invoices are in each state. */
  @InjectManager()
  async counts(
    @MedusaContext() sharedContext: Context = {}
  ): Promise<Record<InvoiceStatus, number>> {
    const manager = sharedContext.manager as Executor
    const rows = (await manager.execute(
      `SELECT status, count(*)::integer AS count FROM invoice
        WHERE deleted_at IS NULL GROUP BY status`,
      []
    )) as { status: InvoiceStatus; count: number }[]
    const counts: Record<InvoiceStatus, number> = {
      pending: 0,
      issuing: 0,
      issued: 0,
      failed: 0,
      cancelled: 0,
    }
    for (const row of rows) {
      counts[row.status] = row.count
    }
    return counts
  }
}
