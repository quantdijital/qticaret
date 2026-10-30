/** An invoice record as the API shows it: no buyer, no program tokens. */
export function invoiceView(row: {
  id: string
  order_id: string
  kind: string
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
  program_difference: number | null
  created_at: Date | string
}) {
  return {
    id: row.id,
    order_id: row.order_id,
    kind: row.kind,
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
    program_difference: row.program_difference,
    created_at: row.created_at,
  }
}
