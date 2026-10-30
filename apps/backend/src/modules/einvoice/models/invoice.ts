import { model } from "@medusajs/framework/utils"

export const INVOICE_KINDS = ["sale", "return"] as const
export const INVOICE_PROVIDERS = ["parasut", "external", "fake"] as const
export const DOCUMENT_TYPES = ["e_invoice", "e_archive"] as const
/**
 * `pending`: to be started, or (external) to be written back; `issuing`:
 * started at the program, its outcome awaited; `failed`: stopped after
 * the last try, staff told.
 */
export const INVOICE_STATUSES = ["pending", "issuing", "issued", "failed", "cancelled"] as const

/**
 * An order's invoice (F8, adr/0034 §2): a sale's, or a return's. Each of
 * the program's own records (its invoice, its e-document, the job issuing
 * it) is kept the moment it is made, so a try that stops halfway carries
 * on and never makes a second one. No personal data: the buyer is read
 * from the order when it is sent.
 */
export const Invoice = model
  .define("invoice", {
    id: model.id({ prefix: "inv" }).primaryKey(),
    order_id: model.text(),
    kind: model.enum([...INVOICE_KINDS]),
    /** The order for a sale; the return request or refund for a return. */
    source_id: model.text(),
    provider: model.enum([...INVOICE_PROVIDERS]),
    status: model.enum([...INVOICE_STATUSES]).default("pending"),
    document_type: model.enum([...DOCUMENT_TYPES]).nullable(),
    attempts: model.number().default(0),
    /** When it is tried (or asked about) next; a claim pushes it on while it is worked on. */
    next_attempt_at: model.dateTime(),
    /** A code only: never a message that may quote the buyer. */
    last_error: model.text().nullable(),
    /** The program's invoice. */
    external_id: model.text().nullable(),
    /** The program's company it was made in: never followed in another (adr/0034 §5). */
    company_id: model.text().nullable(),
    /** The program's e-Fatura or e-Arşiv. */
    document_id: model.text().nullable(),
    /** The program's job issuing it, and when it started (Paraşüt's lasts 15 minutes). */
    job_id: model.text().nullable(),
    job_started_at: model.dateTime().nullable(),
    number: model.text().nullable(),
    /** ETTN. */
    uuid: model.text().nullable(),
    issued_at: model.dateTime().nullable(),
    /** Until when an e-Arşiv can still be cancelled. */
    cancellable_until: model.dateTime().nullable(),
    /** The PDF, in the private store. */
    pdf_file_id: model.text().nullable(),
    /** As we computed them. */
    net_total: model.bigNumber(),
    vat_total: model.bigNumber(),
    gross_total: model.bigNumber(),
    /** The program's total less ours, in kuruş, when they differ (a rounding). */
    program_difference: model.number().nullable(),
    /**
     * The order was canceled: the job undoes the invoice at its program
     * (a draft deleted, an e-Arşiv cancelled within its days) or, too
     * late for that, leaves it issued for a return document (adr/0034 §10).
     */
    cancel_requested_at: model.dateTime().nullable(),
    /** A return's invoice: the sale's it returns. */
    original_invoice_id: model.text().nullable(),
  })
  .indexes([
    { on: ["order_id", "kind", "source_id"], unique: true, where: "deleted_at IS NULL" },
    { on: ["status", "next_attempt_at"] },
    { on: ["order_id"] },
    // An invoice number names one invoice: a number written back twice is refused
    { on: ["number"], unique: true, where: "number IS NOT NULL AND deleted_at IS NULL" },
  ])
