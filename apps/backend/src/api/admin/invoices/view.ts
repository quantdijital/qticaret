/** An invoice record as the API shows it: no buyer, no program tokens. */
export function invoiceView(row: {
  id: string
  order_id: string
  kind: string
  source_id: string
  provider: string
  status: string
  document_type: string | null
  number: string | null
  uuid: string | null
  issued_at: Date | string | null
  cancellable_until: Date | string | null
  attempts: number
  last_error: string | null
  pdf_file_id: string | null
  gross_total: unknown
  advance_total?: number | string | null
  program_difference: number | null
  created_at: Date | string
  waived_reason?: string | null
}) {
  return {
    id: row.id,
    order_id: row.order_id,
    kind: row.kind,
    /** A sale of what an exchange sent instead (E6b): its own invoice beside the order's first. */
    for_exchange: row.kind === "sale" && row.source_id !== row.order_id,
    provider: row.provider,
    status: row.status,
    document_type: row.document_type,
    number: row.number,
    uuid: row.uuid,
    issued_at: row.issued_at,
    cancellable_until: row.cancellable_until,
    attempts: row.attempts,
    last_error: row.last_error,
    has_pdf: row.pdf_file_id !== null,
    total: String(row.gross_total),
    /**
     * The sale's gift card lines, left off the invoice: money taken in
     * advance (avans, docs/mali-musavir-sorulari.md 3.2); null for none.
     */
    advance:
      row.advance_total === null || row.advance_total === undefined
        ? null
        : String(row.advance_total),
    program_difference: row.program_difference,
    created_at: row.created_at,
    /** No document needed: the accountant's exception that applied, or `advance_only`. */
    waived_reason: row.waived_reason ?? null,
  }
}
