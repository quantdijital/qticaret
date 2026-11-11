import type { SheetProblem } from "../../../lib/catalog-sheet"
import { serverErrorMessage } from "../../../lib/errors/messages"
import type { Assessment } from "../../../lib/seo/advisor"
import type { SheetCell } from "../../../lib/sheets"

/**
 * The import's report file (F3.9): a row per problem and per product,
 * with the file's row number, so the sheet can be fixed and sent again.
 * The words are the server's Turkish (as notifications', F19 for more).
 */

export const REPORT_HEADER = [
  "Satır",
  "Tanıtıcı",
  "Sonuç",
  "Sütun",
  "Açıklama",
  "SEO puanı",
  "SEO önerileri",
] as const

export const REPORT_WIDTHS = [8, 28, 16, 18, 60, 10, 40] as const

export type Outcome =
  "create" | "update" | "unchanged" | "created" | "updated" | "failed" | "limited"

const OUTCOME_TEXT: Readonly<Record<Outcome, string>> = {
  create: "Eklenecek",
  update: "Güncellenecek",
  unchanged: "Değişiklik yok",
  created: "Eklendi",
  updated: "Güncellendi",
  failed: "Hata",
  // adr/0061 Ek C14: past the package's product limit, the rest is reported, not written
  limited: "Paket limiti",
}

/** A new product the package's product limit leaves out (adr/0061 Ek C14). */
export const limitedRow = (line: number, handle: string): SheetCell[] =>
  productRow(line, handle, "limited", {
    message: serverErrorMessage("catalog_import.plan_limit", "tr"),
  })

export function problemRow(problem: SheetProblem, handle: string | undefined): SheetCell[] {
  return [
    problem.line,
    handle ?? null,
    OUTCOME_TEXT.failed,
    problem.column ?? null,
    serverErrorMessage(problem.key, "tr"),
    null,
    null,
  ]
}

/** A product's note in its row: going on without weight or measures (adr/0054). */
export const measuresNote = (plan: { noMeasures?: boolean }): { message?: string } =>
  plan.noMeasures ? { message: serverErrorMessage("catalog_import.no_measures", "tr") } : {}

export function productRow(
  line: number,
  handle: string,
  outcome: Outcome,
  detail: { message?: string; assessment?: Assessment }
): SheetCell[] {
  return [
    line,
    handle,
    OUTCOME_TEXT[outcome],
    null,
    detail.message ?? null,
    detail.assessment?.score ?? null,
    detail.assessment ? detail.assessment.issues.map((issue) => issue.ruleId).join(", ") : null,
  ]
}

export interface SeoSummary {
  grades: Record<string, number>
  /** The rules most new products break, most first, with one product's values for the sentence. */
  top: { rule: string; count: number; params: Record<string, string | number> }[]
}

/** How the new products stand: products per grade and the commonest issues. */
export function seoSummary(assessments: readonly Assessment[]): SeoSummary {
  const grades: Record<string, number> = {}
  const rules = new Map<string, { count: number; params: Record<string, string | number> }>()
  for (const assessment of assessments) {
    grades[assessment.grade] = (grades[assessment.grade] ?? 0) + 1
    for (const issue of assessment.issues) {
      const seen = rules.get(issue.ruleId)
      rules.set(issue.ruleId, {
        count: (seen?.count ?? 0) + 1,
        params: seen?.params ?? issue.params,
      })
    }
  }
  const top = [...rules.entries()]
    .sort(([a, x], [b, y]) => y.count - x.count || a.localeCompare(b))
    .slice(0, 5)
    .map(([rule, seen]) => ({ rule, ...seen }))
  return { grades, top }
}
