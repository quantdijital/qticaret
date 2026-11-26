import type { SheetCell } from "../../../lib/sheets"

/**
 * Bulk edit's report file (F3.10): a row per product named, what happened
 * to it and why, in the server's Turkish (as the import's, F19 for more).
 */

export const BULK_REPORT_HEADER = ["Tanıtıcı", "Ürün adı", "Sonuç", "Açıklama"] as const
export const BULK_REPORT_WIDTHS = [28, 40, 16, 60] as const

export type BulkOutcome = "changed" | "unchanged" | "skipped" | "failed"

const OUTCOME_TEXT: Readonly<Record<BulkOutcome, string>> = {
  changed: "Güncellendi",
  unchanged: "Değişiklik yok",
  skipped: "Atlandı",
  failed: "Hata",
}

export function bulkRow(
  product: { handle: string | null; title: string | null },
  outcome: BulkOutcome,
  message: string | null = null
): SheetCell[] {
  return [product.handle, product.title, OUTCOME_TEXT[outcome], message]
}

/** A product left out or failed, as the panel lists it under the run's counts. */
export interface BulkProblem {
  handle: string
  title: string | null
  message: string
}

/** Problems a summary names at most; the report file has them all. */
export const MAX_PROBLEMS = 50

/** The problem a product's outcome is, if any, while there is room for one more. */
export function problemOf(
  problems: readonly BulkProblem[],
  product: { handle: string; title: string | null },
  outcome: BulkOutcome,
  message: string | null
): BulkProblem | null {
  if ((outcome !== "skipped" && outcome !== "failed") || problems.length >= MAX_PROBLEMS) {
    return null
  }
  return { handle: product.handle, title: product.title, message: message ?? "" }
}
