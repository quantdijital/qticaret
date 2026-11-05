import { valueText } from "../../../lib/catalog/facts"
import type { MatchTemplate, MatchedRow, ParseFailure } from "../../../lib/catalog/facts"
import type { SheetCell } from "../../../lib/sheets"
import type { AttributeInputValue } from "../../../modules/product-attributes/validation"

/**
 * The facts run's report file (adr/0013 Ek 2026-11-05): a row per product
 * named, what was written and what was left with why, in the server's
 * Turkish (as the bulk edit's).
 */

export const FACTS_REPORT_HEADER = ["Tanıtıcı", "Ürün adı", "Sonuç", "Yazılan", "Yazılmayan"]
export const FACTS_REPORT_WIDTHS = [28, 36, 16, 60, 60]

export type FactsOutcome = "changed" | "unchanged" | "skipped" | "failed"

const OUTCOME_TEXT: Readonly<Record<FactsOutcome, string>> = {
  changed: "Yazıldı",
  unchanged: "Değişiklik yok",
  skipped: "Atlandı",
  failed: "Hata",
}

const REASON_TEXT: Readonly<Record<ParseFailure, string>> = {
  number: "sayı okunamadı",
  range: "iki sayılı aralık",
  unit: "birimi alanın birimine çevrilemiyor",
  option: "alanın seçeneklerinde yok",
  boolean: "evet ya da hayır değil",
  text: "metin çok uzun ya da okunamıyor",
}

/** Why a row was not written, in a few words. */
export function leftText(row: MatchedRow, overwrite: boolean): string | null {
  switch (row.status) {
    case "ready":
    case "same":
      return null
    case "filled":
      return overwrite ? null : "üründe başka bir değer var"
    case "unparsed":
      return row.reason ? REASON_TEXT[row.reason] : "okunamadı"
    case "conflict":
      return "başka bir satır başka bir değer veriyor"
    case "ambiguous":
      return "birden çok alana uyuyor"
    case "unmatched":
      return "şablonda bu adda alan yok"
  }
}

/** The values written, "Label: value" each. */
export function writtenText(
  template: MatchTemplate,
  values: Readonly<Record<string, AttributeInputValue>>
): string {
  return Object.entries(values)
    .map(([key, value]) => {
      const field = template.definitions.find((each) => each.key === key)
      return field ? `${field.label}: ${valueText(field, value)}` : key
    })
    .join("; ")
}

/** The rows left, "Label (why)" each. */
export function leftRowsText(rows: readonly MatchedRow[], overwrite: boolean): string {
  return rows
    .flatMap((row) => {
      const why = leftText(row, overwrite)
      return why ? [`${row.label}: ${row.value} (${why})`] : []
    })
    .join("; ")
}

export function factsRow(
  product: { handle: string | null; title: string | null },
  outcome: FactsOutcome,
  written: string | null,
  left: string | null
): SheetCell[] {
  const orNone = (text: string | null) => (text === "" ? null : text)
  return [product.handle, product.title, OUTCOME_TEXT[outcome], orNone(written), orNone(left)]
}
