import { CSV_BOM, readCsv, toCsv } from "../../../lib/security"
import { QUERY_POLICIES, REDIRECT_MATCHES, REDIRECT_STATUSES } from "../../../lib/seo/redirects"
import type { RedirectRule } from "../../../lib/seo/redirects"
import type { RedirectInput } from "./plan"

/**
 * The redirect file (docs/13 §4): one rule per row, the columns by their
 * header names, so a file a crawler or another platform made only needs
 * `source` and `target`. What the export writes, the import reads back.
 */

export const REDIRECT_CSV_COLUMNS = [
  "source",
  "target",
  "status",
  "match",
  "query_policy",
  "query_keep",
] as const

export const MAX_IMPORT_ROWS = 1000

export interface ImportRow {
  line: number
  rule: RedirectInput
}

export interface RowProblem {
  line: number
  key: string
  field?: string | undefined
}

const pick = <T extends string | number>(values: readonly T[], text: string): T | undefined =>
  values.find((value) => String(value) === text)

function ruleOf(cells: Record<string, string>): RedirectInput | RowProblem["key"] {
  const status = cells["status"] ? pick(REDIRECT_STATUSES, cells["status"]) : 301
  const match = cells["match"] ? pick(REDIRECT_MATCHES, cells["match"].toLowerCase()) : "exact"
  const policy = cells["query_policy"]
    ? pick(QUERY_POLICIES, cells["query_policy"].toLowerCase())
    : "keep"
  if (status === undefined) {
    return "seo.redirect_status_invalid"
  }
  if (match === undefined) {
    return "seo.redirect_match_invalid"
  }
  if (policy === undefined) {
    return "seo.redirect_query_invalid"
  }
  const keep = (cells["query_keep"] ?? "")
    .split(/[|,]/)
    .map((name) => name.trim())
    .filter(Boolean)
  return {
    source: cells["source"] ?? "",
    target: cells["target"] ?? null,
    status,
    match,
    query_policy: policy,
    query_keep: keep,
  }
}

/** The file's rules, or what is wrong with the file or its rows (by line). */
export function readRedirectCsv(
  text: string
): { rows: ImportRow[]; problems: RowProblem[] } | { fileProblem: string } {
  const read = readCsv(text, { maxRows: MAX_IMPORT_ROWS, maxCells: 20 })
  if (!read.ok) {
    return { fileProblem: read.key }
  }
  if (!read.header.includes("source")) {
    return { fileProblem: "seo.redirect_csv_header" }
  }
  const rows: ImportRow[] = []
  const problems: RowProblem[] = []
  for (const row of read.rows) {
    const cells = Object.fromEntries(
      read.header.map((name, index) => [name, (row.cells[index] ?? "").trim()])
    )
    const rule = ruleOf(cells)
    if (typeof rule === "string") {
      problems.push({ line: row.line, key: rule })
    } else {
      rows.push({ line: row.line, rule })
    }
  }
  return { rows, problems }
}

/** The rules as a file Turkish Excel opens in columns (`;`, BOM); formulas escaped. */
export function writeRedirectCsv(rules: readonly RedirectRule[]): string {
  const rows = rules.map((rule) => [
    rule.source,
    rule.target ?? "",
    rule.status,
    rule.match,
    rule.query_policy,
    (rule.query_keep ?? []).join("|"),
  ])
  return `${CSV_BOM}${toCsv([[...REDIRECT_CSV_COLUMNS], ...rows], ";")}`
}

/**
 * Lines of exact rules that a file sends round in a circle among
 * themselves (A→B, B→A): a dry run writes nothing, so the save-time loop
 * check cannot see one row from another.
 */
export function loopingLines(
  rows: readonly { line: number; fields: Pick<RedirectRule, "source" | "match" | "target"> }[]
): number[] {
  const next = new Map<string, string>()
  for (const { fields } of rows) {
    if (fields.match === "exact" && fields.target !== null) {
      next.set(fields.source, fields.target.split("?")[0] ?? fields.target)
    }
  }
  return rows.flatMap(({ line, fields }) => {
    let current = next.get(fields.source)
    for (let step = 0; current !== undefined && step < next.size; step += 1) {
      if (current === fields.source) {
        return [line]
      }
      current = next.get(current)
    }
    return []
  })
}
