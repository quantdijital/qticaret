import { serverErrorMessage } from "../../lib/errors/messages"
import type { MigrationKind, StepProblem } from "../../lib/migration/types"
import type { SheetCell, SheetSpec } from "../../lib/sheets"
import { REPORT_HEADER, REPORT_WIDTHS } from "../catalog/import/report"

/**
 * A migration's report file (F14, adr/0042 §9): what each kind came to,
 * the products as the catalog import saw them, and every record left out
 * with why. A dry run's says what a run would do; the words are the
 * server's Turkish, as the catalog import's.
 */

export interface KindCounts {
  /** Records the source holds. */
  read: number
  /** Made (would be, in a dry run). */
  created: number
  /** Here already: matched, or moved by a run before, or unchanged. */
  found: number
  /** Changed (would be). */
  updated: number
  /** Left out for a problem. */
  skipped: number
  /** A write refused. */
  failed: number
}

export const emptyCounts = (): KindCounts => ({
  read: 0,
  created: 0,
  found: 0,
  updated: 0,
  skipped: 0,
  failed: 0,
})

export type RunCounts = Record<MigrationKind, KindCounts> & { consent: KindCounts }

const KIND_TEXT: Readonly<Record<keyof RunCounts, string>> = {
  category: "Kategoriler",
  brand: "Markalar",
  product: "Ürünler",
  image: "Görseller",
  customer: "Müşteriler",
  consent: "Ticari ileti izinleri",
  order: "Geçmiş siparişler",
  review: "Yorumlar",
  page: "Sayfalar",
  post: "Blog yazıları",
  post_category: "Blog kategorileri",
  post_tag: "Blog etiketleri",
}

export interface ReportProblem extends StepProblem {
  kind: MigrationKind
}

function summaryRows(mode: "check" | "apply", counts: RunCounts): SheetCell[][] {
  const header =
    mode === "check"
      ? ["Tür", "Kaynakta", "Eklenecek", "Var olan", "Güncellenecek", "Atlanacak", "Hata"]
      : ["Tür", "Kaynakta", "Eklendi", "Var olan", "Güncellendi", "Atlandı", "Hata"]
  return [
    header,
    ...(Object.keys(KIND_TEXT) as (keyof RunCounts)[]).map((kind) => {
      const own = counts[kind]
      return [
        KIND_TEXT[kind],
        own.read,
        own.created,
        own.found,
        own.updated,
        own.skipped,
        own.failed,
      ]
    }),
  ]
}

/** The report's sheets: the summary, the products (the catalog import's rows, by handle), the problems. */
export function reportSheets(
  mode: "check" | "apply",
  counts: RunCounts,
  productRows: readonly SheetCell[][],
  problems: readonly ReportProblem[]
): SheetSpec[] {
  return [
    { name: "Özet", widths: [24, 12, 12, 12, 14, 12, 10], rows: summaryRows(mode, counts) },
    {
      name: "Ürünler",
      widths: REPORT_WIDTHS.slice(1),
      // The catalog import's row numbers are of its own sheet: the handle names the product
      rows: [REPORT_HEADER.slice(1), ...productRows.map((row) => row.slice(1))],
    },
    {
      name: "Notlar",
      widths: [22, 28, 70],
      rows: [
        ["Tür", "Kaynak kimliği", "Açıklama"],
        ...problems.map((problem) => [
          KIND_TEXT[problem.kind],
          problem.source_key,
          serverErrorMessage(problem.key, "tr"),
        ]),
      ],
    },
  ]
}
