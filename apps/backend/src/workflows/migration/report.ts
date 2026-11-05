import { serverErrorMessage } from "../../lib/errors/messages"
import type { MigrationKind, StepProblem } from "../../lib/migration/types"
import type { SheetCell, SheetSpec } from "../../lib/sheets"
import { REPORT_HEADER, REPORT_WIDTHS } from "../catalog/import/report"

/**
 * A migration's report file (F14, adr/0042 §9): what each kind came to,
 * where the new categories' SEO titles and descriptions come from, the
 * products as the catalog import saw them, and every record left out
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
  /** Categories: new ones with the source's own SEO title or description. */
  seo_own?: number
  /** Categories: new ones on the shop's templates, as one made in the panel. */
  seo_default?: number
  /**
   * Products: their description written as a content document (adr/0055),
   * made with one or refreshed (would be, in a dry run).
   */
  documents?: number
  /**
   * Attributes: values the new products' descriptions stated, written to
   * their template's fields (would be), and rows left for the panel
   * (adr/0013 Ek 2026-11-05). Only a source that gives documents counts them.
   */
  facts?: number
  facts_left?: number
}

export const emptyCounts = (): KindCounts => ({
  read: 0,
  created: 0,
  found: 0,
  updated: 0,
  skipped: 0,
  failed: 0,
})

/** `attribute`: the products' descriptive attributes, one per product and attribute (attributes.ts). */
export type RunCounts = Record<MigrationKind, KindCounts> & {
  consent: KindCounts
  attribute: KindCounts
}

const KIND_TEXT: Readonly<Record<keyof RunCounts, string>> = {
  category: "Kategoriler",
  brand: "Markalar",
  product: "Ürünler",
  attribute: "Ürün özellikleri",
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

// Categories and blog categories made here, by where their SEO title and description come from
function seoRows(mode: "check" | "apply", counts: RunCounts): SheetCell[][] {
  const row = (text: string, own: KindCounts | undefined) => [
    text,
    own?.seo_own ?? 0,
    own?.seo_default ?? 0,
  ]
  return [
    [],
    [
      mode === "check"
        ? "Eklenecek kategorilerin SEO alanları"
        : "Eklenen kategorilerin SEO alanları",
      "Kaynaktaki başlık ya da açıklamayla",
      "Mağazanın şablonlarıyla (varsayılan)",
    ],
    row(KIND_TEXT.category, counts.category),
    row(KIND_TEXT.post_category, counts.post_category),
  ]
}

// Products whose description moved as a content document (adr/0055); none for a source without
function documentRows(mode: "check" | "apply", counts: RunCounts): SheetCell[][] {
  const documents = counts.product.documents
  if (documents === undefined) {
    return []
  }
  return [
    [],
    [
      mode === "check"
        ? "Biçimli açıklamayla gelecek ürünler"
        : "Biçimli açıklamayla gelen ürünler",
      documents,
    ],
  ]
}

// The facts the new products' descriptions stated (adr/0013 Ek 2026-11-05); none for a source without
function factsRows(mode: "check" | "apply", counts: RunCounts): SheetCell[][] {
  const { facts, facts_left: left } = counts.attribute
  if (facts === undefined) {
    return []
  }
  return [
    [],
    [
      mode === "check"
        ? "Açıklamalardan özellik alanlarına yazılacak değerler"
        : "Açıklamalardan özellik alanlarına yazılan değerler",
      facts,
    ],
    ["Açıklamalarda panelde karar bekleyen satırlar", left ?? 0],
  ]
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
    {
      name: "Özet",
      widths: [24, 12, 12, 12, 14, 12, 10],
      rows: [
        ...summaryRows(mode, counts),
        ...seoRows(mode, counts),
        ...documentRows(mode, counts),
        ...factsRows(mode, counts),
      ],
    },
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
