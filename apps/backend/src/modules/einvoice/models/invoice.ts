import { model } from "@medusajs/framework/utils"

export const INVOICE_KINDS = ["sale", "return"] as const
export const INVOICE_PROVIDERS = ["parasut", "external", "fake"] as const
/**
 * A sale's e-Fatura or e-Arşiv; a return's document (the accountant,
 * 2026-10-31): the shop's gider pusulası to a person who sent goods back,
 * or the return invoice a company issues to the shop.
 */
export const DOCUMENT_TYPES = [
  "e_invoice",
  "e_archive",
  "expense_voucher",
  "return_invoice",
] as const
/**
 * Why a record needs no document of its own: a return's (the accountant's
 * two exceptions), or a sale made only of gift cards, an advance that no
 * invoice is cut for (`advance_only`, docs/mali-musavir-sorulari.md 3.2).
 */
export const WAIVER_REASONS = [
  "payment_institution",
  "signed_return_section",
  "advance_only",
] as const
/**
 * `pending`: to be started, or (external) to be written back; `issuing`:
 * started at the program, its outcome awaited; `failed`: stopped after
 * the last try, staff told; `waived`: a return that needed no document,
 * or a sale of gift cards alone (its advance kept, no invoice).
 */
export const INVOICE_STATUSES = [
  "pending",
  "issuing",
  "issued",
  "failed",
  "cancelled",
  "waived",
] as const

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
    /**
     * A sale's gift card lines, left off its invoice: money taken in
     * advance (avans), its KDV due when the cards are spent (the
     * accountant, 2026-11-03). Null when the order sold none.
     */
    advance_total: model.bigNumber().nullable(),
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
    /** Waived: which of the accountant's exceptions applied, or an advance alone. */
    waived_reason: model.enum([...WAIVER_REASONS]).nullable(),
  })
  .indexes([
    { on: ["order_id", "kind", "source_id"], unique: true, where: "deleted_at IS NULL" },
    { on: ["status", "next_attempt_at"] },
    { on: ["order_id"] },
    // A number the shop issues names one document: a sale's (GİB number), or
    // its gider pusulası serial. A company's return invoice is numbered in
    // that company's series, so two may share a number (the F15 security review)
    {
      name: "IDX_invoice_sale_number_unique",
      on: ["number"],
      unique: true,
      where: "kind = 'sale' AND number IS NOT NULL AND deleted_at IS NULL",
    },
    {
      name: "IDX_invoice_voucher_number_unique",
      on: ["number"],
      unique: true,
      where:
        "kind = 'return' AND document_type = 'expense_voucher' AND number IS NOT NULL AND deleted_at IS NULL",
    },
  ])
