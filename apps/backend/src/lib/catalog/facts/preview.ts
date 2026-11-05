import type { AttributeInputValue } from "../../../modules/product-attributes/validation"
import { matchFacts } from "./match"
import type { MatchTemplate, MatchedRow, RowStatus } from "./match"
import { productFacts } from "./sources"
import type { FactSource } from "./sources"
import { groupOf, suggestFields } from "./suggest"
import type { FieldSuggestion, UnmatchedUse } from "./suggest"

/**
 * What the facts in products' descriptions would become (adr/0013 Ek
 * 2026-11-05), for the panel's preview and the run that writes them: per
 * product its rows and what each comes to, per template the fields it
 * could take for the labels none of its fields names. A product without a
 * template is read against the one given for such products, if any.
 */

export interface FactsProduct {
  id: string
  title: string
  doc: unknown
  description: string | null
  /** Its own template; none: the one given for products without one. */
  template: MatchTemplate | null
  values: Readonly<Record<string, AttributeInputValue>>
}

export interface ProductPreview {
  id: string
  title: string
  template_id: string | null
  /** The template is the one given for products without one. */
  template_given: boolean
  source: FactSource | null
  rows: (MatchedRow & { group?: string | null })[]
}

export type PreviewCounts = Record<RowStatus, number> & {
  products: number
  /** Products whose description states at least one fact. */
  with_facts: number
  /** Products with facts and no template to read them against. */
  no_template: number
}

export interface FactsPreview {
  products: ProductPreview[]
  suggestions: { template_id: string; fields: FieldSuggestion[] }[]
  counts: PreviewCounts
  /** For products without a template: the one whose fields their facts name most. */
  suggested_template_id: string | null
}

const EMPTY: MatchTemplate = { id: "", definitions: [] }

/** One product's rows against its template (or the one given). */
export function previewProduct(
  product: FactsProduct,
  given: MatchTemplate | null
): { preview: ProductPreview; unmatched: UnmatchedUse[] } {
  const facts = productFacts({ doc: product.doc, description: product.description })
  const template = product.template ?? given
  const rows = matchFacts(facts.rows, template ?? EMPTY, product.template ? product.values : {})
  const unmatched: UnmatchedUse[] = template
    ? rows
        .filter((row) => row.status === "unmatched")
        .map((row) => ({ product_id: product.id, row, group: groupOf(row, rows, template) }))
    : []
  const groups = new Map(unmatched.map((use) => [use.row, use.group]))
  return {
    preview: {
      id: product.id,
      title: product.title,
      template_id: template?.id ?? null,
      template_given: !product.template && Boolean(given),
      source: facts.source,
      rows: rows.map((row) => (groups.has(row) ? { ...row, group: groups.get(row) ?? null } : row)),
    },
    unmatched,
  }
}

const emptyCounts = (): PreviewCounts => ({
  products: 0,
  with_facts: 0,
  no_template: 0,
  ready: 0,
  same: 0,
  filled: 0,
  unparsed: 0,
  conflict: 0,
  ambiguous: 0,
  unmatched: 0,
})

/** The template whose fields name most facts of products without one. */
function suggestTemplate(
  products: readonly FactsProduct[],
  templates: readonly MatchTemplate[]
): string | null {
  const bare = products.filter((product) => !product.template)
  let best: { id: string; named: number } | null = null
  for (const template of templates) {
    const named = bare
      .flatMap((product) => matchFacts(productFacts(product).rows, template, {}))
      .filter((row) => row.status !== "unmatched" && row.status !== "ambiguous").length
    if (named > 0 && (!best || named > best.named)) {
      best = { id: template.id, named }
    }
  }
  return best?.id ?? null
}

/** Every product's preview, each template's suggested fields and the counts. */
export function previewFacts(
  products: readonly FactsProduct[],
  given: MatchTemplate | null,
  templates: readonly MatchTemplate[]
): FactsPreview {
  const counts = emptyCounts()
  const uses = new Map<string, UnmatchedUse[]>()
  const previews = products.map((product) => {
    const { preview, unmatched } = previewProduct(product, given)
    counts.products += 1
    if (preview.rows.length > 0) {
      counts.with_facts += 1
      if (!preview.template_id) {
        counts.no_template += 1
      }
    }
    for (const row of preview.rows) {
      counts[row.status] += 1
    }
    if (preview.template_id && unmatched.length > 0) {
      uses.set(preview.template_id, [...(uses.get(preview.template_id) ?? []), ...unmatched])
    }
    return preview
  })
  const byId = new Map([...templates, ...(given ? [given] : [])].map((each) => [each.id, each]))
  return {
    products: previews,
    suggestions: [...uses].flatMap(([id, own]) => {
      const template = byId.get(id)
      return template ? [{ template_id: id, fields: suggestFields(own, template) }] : []
    }),
    counts,
    suggested_template_id: given ? null : suggestTemplate(products, templates),
  }
}
