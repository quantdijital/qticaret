import type { InvoiceDraft } from "./types"

/**
 * A program that issues invoices (adr/0034 §4). It moves an invoice one
 * stretch on from where its record stands, keeping each record the program
 * makes the moment it makes it (`keep`), so a try that stops halfway
 * carries on and never makes a second one.
 */

export type ProgramDocument = "e_invoice" | "e_archive"

/** What the invoice's record holds of the program's own records. */
export interface ProgramState {
  id: string
  external_id: string | null
  document_id: string | null
  document_type: ProgramDocument | null
  job_id: string | null
  job_started_at: Date | null
  number: string | null
  cancellable_until: Date | null
}

export interface KeptProgress {
  external_id?: string
  document_id?: string
  document_type?: ProgramDocument
  job_id?: string | null
  job_started_at?: Date | null
  number?: string
  uuid?: string | null
  cancellable_until?: Date | null
  program_difference?: number | null
}

export interface AdvanceContext {
  /** The invoice as the order asks for it; read only when the program needs it (personal data). */
  draft: () => Promise<InvoiceDraft>
  /** Keeps what the program made; false when the claim was lost (stop at once). */
  keep: (progress: KeptProgress) => Promise<boolean>
  now: () => Date
}

export type AdvanceOutcome =
  /** Started at the program: asked about again shortly. */
  | { next: "issuing"; progress: KeptProgress }
  /** Still being made (the job, or its PDF): asked about again shortly. */
  | { next: "waiting" }
  /** Issued, its PDF in hand. */
  | { next: "issued"; progress: KeptProgress & { number: string }; pdf: Buffer }
  /**
   * Not this time: tried again later, or (`stop`) not on its own at all,
   * for staff to look at the program first (an outcome not known).
   */
  | { next: "failed"; code: string; stop?: true }

export interface InvoiceProvider {
  readonly id: "parasut" | "fake"
  advance(state: ProgramState, context: AdvanceContext): Promise<AdvanceOutcome>
  /**
   * Undoes the invoice at the program, its order canceled (adr/0034 §10):
   * a draft deleted, an e-Arşiv cancelled within its days; `too_late` when
   * it stands (an e-Fatura, or past the days) and a return document is due.
   */
  cancel(state: ProgramState, now: Date): Promise<"cancelled" | "too_late">
}

/** The kuruş the program's total is off ours by; null when they agree or it said none. */
export function differenceOf(draft: InvoiceDraft, programGross: string | null): number | null {
  if (programGross === null) {
    return null
  }
  const cents = (value: string) => Math.round(Number(value) * 100)
  const difference = cents(programGross) - cents(draft.totals.gross)
  return Number.isFinite(difference) && difference !== 0 ? difference : null
}
