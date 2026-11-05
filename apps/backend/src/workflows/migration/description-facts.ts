import { attributeValueOf } from "../../lib/catalog-sheet"
import { factsFromBlocks, matchFacts } from "../../lib/catalog/facts"
import type { FactRow, MatchTemplate, MatchedRow } from "../../lib/catalog/facts"
import type {
  AttributeInputValue,
  AttributeOption,
  AttributeType,
} from "../../modules/product-attributes/validation"
import type { KindCounts, ReportProblem } from "./report"

/**
 * The facts a moved product's description states (adr/0013 Ek
 * 2026-11-05), written with its other attributes when the import gives
 * it a template: a row is written only when its label names exactly one
 * field of that template, its value reads as the field's type, no other
 * row (and no attribute the source gave) says otherwise, and the field is
 * still empty. Every other row is left for the panel's "Açıklamadaki
 * özellikleri aktar" and counted in the report. A product without a
 * template takes none: the panel gives it one.
 */

interface Field {
  key: string
  label: string
  type: AttributeType
  scope: "product" | "variant"
  options: AttributeOption[] | null
  unit?: string | null | undefined
  group?: string | null | undefined
  aliases?: readonly string[] | undefined
}

export interface FactTemplate {
  handle: string
  groups?: readonly { key: string; name: string }[] | undefined
  fields: readonly Field[]
}

export interface FactCells {
  /** A field's key → its cell, for the fields the facts fill. */
  cells: Record<string, string>
  /** Rows written. */
  written: number
  /** Labels of the rows left for the panel. */
  left: string[]
}

const isDoc = (value: unknown): value is { content: Parameters<typeof factsFromBlocks>[0] } =>
  typeof value === "object" &&
  value !== null &&
  (value as { type?: unknown }).type === "doc" &&
  Array.isArray((value as { content?: unknown }).content)

/**
 * The facts of a source product's description document and of its short
 * description's document ("Namlu: 9 cm" in a list or in lines; adr/0055
 * Ek 2026-11-06), read apart (a heading at the description's end is no
 * section of the short one); a row both state counts once. None without
 * either.
 */
export function descriptionFactsOf(doc: unknown, summary?: unknown): FactRow[] {
  const own = isDoc(doc) ? factsFromBlocks(doc.content) : []
  if (!isDoc(summary)) {
    return own
  }
  const said = new Set(own.map((row) => `${row.label}\u0000${row.value}`))
  return [
    ...own,
    ...factsFromBlocks(summary.content, "summary").filter(
      (row) => !said.has(`${row.label}\u0000${row.value}`)
    ),
  ]
}

const matchTemplate = (template: FactTemplate): MatchTemplate => ({
  id: template.handle,
  groups: template.groups ?? [],
  definitions: template.fields.map((field) => ({ ...field, unit: field.unit ?? null })),
})

/** A value as the catalog import reads its cell back. */
function cellOf(value: Exclude<AttributeInputValue, null>): string {
  if (Array.isArray(value)) {
    return value.join("|")
  }
  if (typeof value === "boolean") {
    return value ? "evet" : "hayir"
  }
  return String(value)
}

/**
 * The cells the facts add to a template's (the source's own cells win);
 * `cells` are the source attributes' cells, by field key.
 */
export function factCells(
  template: FactTemplate,
  facts: readonly FactRow[],
  cells: Readonly<Record<string, string>>
): FactCells {
  const current: Record<string, AttributeInputValue> = {}
  for (const [key, cell] of Object.entries(cells)) {
    const field = template.fields.find((each) => each.key === key)
    const read = field ? attributeValueOf({ ...field, is_required: false }, cell) : null
    if (read?.ok) {
      current[key] = read.value
    }
  }
  const rows = matchFacts(facts, matchTemplate(template), current)
  const out: FactCells = { cells: {}, written: 0, left: [] }
  for (const row of rows) {
    const cell = takenCell(row, template)
    if (cell && row.field && !Object.hasOwn(out.cells, row.field)) {
      out.cells[row.field] = cell
      out.written += 1
    } else if (row.status !== "same" && !(cell && row.field)) {
      out.left.push(row.label)
    }
  }
  return out
}

// A ready row's cell, once the import would read it as the field takes it
function takenCell(row: MatchedRow, template: FactTemplate): string | null {
  const field = template.fields.find((each) => each.key === row.field)
  if (row.status !== "ready" || !field || row.value_parsed === undefined) {
    return null
  }
  const cell = cellOf(row.value_parsed)
  return attributeValueOf({ ...field, is_required: false }, cell).ok ? cell : null
}

const MAX_NOTES = 100

/**
 * The facts' counts for the report (`facts` written, `facts_left` for the
 * panel), for the products this run made (would make), and a note per
 * label left with how many products have it, the commonest first.
 */
export function factsOutcome(
  plans: readonly { source_key: string; facts?: FactCells | undefined }[],
  made: ReadonlySet<string>
): { counts: Pick<KindCounts, "facts" | "facts_left">; problems: ReportProblem[] } {
  let facts = 0
  let left = 0
  const labels = new Map<string, { label: string; products: number }>()
  for (const plan of plans) {
    if (!plan.facts || !made.has(plan.source_key)) {
      continue
    }
    facts += plan.facts.written
    left += plan.facts.left.length
    for (const label of new Set(plan.facts.left)) {
      const key = label.toLocaleLowerCase("tr")
      const tally = labels.get(key) ?? { label, products: 0 }
      tally.products += 1
      labels.set(key, tally)
    }
  }
  const problems = [...labels.values()]
    .sort((a, b) => b.products - a.products || a.label.localeCompare(b.label, "tr"))
    .slice(0, MAX_NOTES)
    .map((tally) => ({
      kind: "product" as const,
      source_key: `"${tally.label}": ${String(tally.products)} ürün`,
      key: "migration.description_facts_left",
    }))
  return { counts: { facts, facts_left: left }, problems }
}
