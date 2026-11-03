import type { AttributePlan, AttributedProduct, SourceAttribute } from "./attributes"
import type { KindCounts, ReportProblem } from "./report"

/**
 * What came of the products' descriptive attributes (adr/0042 Ek
 * 2026-11-03), for the report: each product's attribute counted once
 * (written, here already, or left), and the notes. An attribute no
 * template has a field for is named with its values, at most fifty, the
 * commonest first, each with how many products have it: a template can
 * be made from it and the run made again. One a field matches but whose
 * value it does not take is named with those values; one only another
 * template has, and a product whose template's required field stays
 * empty, are named too. The words are the server's Turkish.
 */

const MAX_VALUES = 50
const MAX_NOTE = 8_000

interface Tally {
  name: string
  products: number
  values: Map<string, number>
}

/** Values by how many products have them, the commonest first, at most fifty. */
export function valueList(values: ReadonlyMap<string, number>): string {
  const sorted = [...values].sort(([a, x], [b, y]) => y - x || a.localeCompare(b, "tr"))
  const shown = sorted.slice(0, MAX_VALUES).map(([value, n]) => `${value} (${String(n)})`)
  const rest = sorted.length - shown.length
  return rest > 0 ? `${shown.join("; ")}; … +${String(rest)} değer` : shown.join("; ")
}

function add(tallies: Map<string, Tally>, attribute: SourceAttribute, values: readonly string[]) {
  const tally: Tally = tallies.get(attribute.key) ?? {
    name: attribute.name,
    products: 0,
    values: new Map<string, number>(),
  }
  tally.products += 1
  for (const value of values) {
    tally.values.set(value, (tally.values.get(value) ?? 0) + 1)
  }
  tallies.set(attribute.key, tally)
}

function notes(
  tallies: ReadonlyMap<string, Tally>,
  key: string,
  withValues: boolean
): ReportProblem[] {
  return [...tallies].map(([attribute, tally]) => {
    const head = `${attribute} "${tally.name}": ${String(tally.products)} ürün`
    const text = withValues
      ? `${head}, ${String(tally.values.size)} değer: ${valueList(tally.values)}`
      : head
    return { kind: "product" as const, source_key: text.slice(0, MAX_NOTE), key }
  })
}

/**
 * The attributes' counts and notes. `made`: the products this run made
 * (would make, in a dry run); `moved`: ones a run before made, left as
 * the shop keeps them now.
 */
export function attributeOutcome(
  products: readonly AttributedProduct[],
  plans: ReadonlyMap<string, AttributePlan>,
  made: ReadonlySet<string>,
  moved: ReadonlySet<string>
): { counts: Partial<KindCounts>; problems: ReportProblem[] } {
  const counts = { read: 0, created: 0, found: 0, skipped: 0 }
  const unmatched = new Map<string, Tally>()
  const unfit = new Map<string, Tally>()
  const elsewhere = new Map<string, Tally>()
  const required: ReportProblem[] = []
  for (const product of products) {
    const attributes = product.attributes ?? []
    const plan = plans.get(product.source_key)
    if (attributes.length === 0 || !plan) {
      continue
    }
    counts.read += attributes.length
    const isMade = made.has(product.source_key)
    if (moved.has(product.source_key)) {
      counts.found += attributes.length
    } else {
      const written = isMade ? plan.written.length : 0
      counts.created += written
      counts.skipped += attributes.length - written
    }
    for (const attribute of attributes) {
      // The values a template could be made from: every product's, whatever became of it
      if (plan.unmatched.includes(attribute.key)) {
        add(unmatched, attribute, attribute.values)
      } else if (isMade && plan.unfit.includes(attribute.key)) {
        add(unfit, attribute, [attribute.values.join(" | ")])
      } else if (isMade && plan.elsewhere.includes(attribute.key)) {
        add(elsewhere, attribute, [])
      }
    }
    if (isMade && plan.requiredMissing) {
      required.push({
        kind: "product",
        source_key: product.source_key,
        key: "catalog_import.attribute_required",
      })
    }
  }
  return {
    counts,
    problems: [
      ...notes(unmatched, "migration.wordpress_attribute_not_moved", true),
      ...notes(unfit, "catalog_import.attribute_invalid", true),
      ...notes(elsewhere, "catalog_import.attribute_unknown", false),
      ...required,
    ],
  }
}
