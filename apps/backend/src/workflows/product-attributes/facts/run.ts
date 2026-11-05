import type { MedusaContainer } from "@medusajs/framework/types"
import { chunksOf } from "../../../lib/catalog"
import { matchFacts, productFacts, valuesToWrite } from "../../../lib/catalog/facts"
import { ValidationError } from "../../../lib/errors"
import { serverErrorMessage } from "../../../lib/errors/messages"
import { errorSummary, logger } from "../../../lib/logging"
import type { SheetCell } from "../../../lib/sheets"
import { writeErrorText } from "../../catalog/write-error"
import { upsertProductAttributesWorkflow } from "../upsert-product-attributes"
import type { FactsApplyInput } from "./input"
import { readFactsProducts, readMatchTemplates } from "./read"
import type { NamedTemplate, ReadProduct } from "./read"
import { factsRow, leftRowsText, writtenText } from "./report"
import type { FactsOutcome } from "./report"
import { applyTemplateChanges } from "./template-changes"
import type { TemplateChange } from "./template-changes"

/**
 * Writes the facts in products' descriptions to their attribute values
 * (adr/0013 Ek 2026-11-05), as the panel's preview showed them: first the
 * fields and other names the shop ticked go into their templates, then
 * each product's rows are read again and matched, and the values its
 * template takes are written through the attribute workflow (its checks,
 * its lock, its undo), one product at a time: a product that cannot take
 * them costs that product, not the rest. A value the product holds stays
 * unless `overwrite`; nothing is removed, the description is never
 * touched. Products without a template take the one given, if any.
 */

export interface FactsRunHooks {
  progress: (percent: number) => Promise<void>
  /** The run in the audit log as it starts and ends, and each template it changed (adr/0011). */
  audit: (action: string, changes: Record<string, unknown>) => Promise<void>
  /** A product it wrote, each value before and after. */
  auditProduct: (productId: string, changes: Record<string, unknown>) => Promise<void>
}

export interface FactsRunSummary {
  products: number
  changed: number
  unchanged: number
  skipped: number
  failed: number
  /** Values written. */
  values: number
  fields_added: number
  aliases_added: number
}

// Products are read this many at a time, each just before it is written
const CHUNK = 20

interface Outcome {
  outcome: FactsOutcome
  values: number
  row: SheetCell[]
}

async function writeOne(
  container: MedusaContainer,
  product: ReadProduct,
  template: NamedTemplate,
  input: FactsApplyInput,
  hooks: FactsRunHooks
): Promise<Outcome> {
  const current = product.template ? product.values : {}
  const rows = matchFacts(productFacts(product).rows, template, current)
  const values = valuesToWrite(rows, input.overwrite)
  const left = leftRowsText(rows, input.overwrite)
  if (Object.keys(values).length === 0) {
    const none = rows.length === 0 ? serverErrorMessage("description_facts.none", "tr") : left
    return { outcome: "unchanged", values: 0, row: factsRow(product, "unchanged", null, none) }
  }
  // The template's own rule: its required fields are filled; said here by name, not as a refusal
  const empty = template.definitions.filter(
    (field) =>
      field.scope === "product" &&
      field.is_required &&
      (current[field.key] ?? null) === null &&
      !Object.hasOwn(values, field.key)
  )
  if (empty.length > 0) {
    const fields = empty.map((field) => field.label).join(", ")
    const why = serverErrorMessage("description_facts.required_missing", "tr", { fields })
    return { outcome: "skipped", values: 0, row: factsRow(product, "skipped", null, why) }
  }
  try {
    await upsertProductAttributesWorkflow(container).run({
      input: { product_id: product.id, template_id: template.id, values },
    })
  } catch (error) {
    logger.warn({
      event: "product_attributes.facts_write_failed",
      productId: product.id,
      err: errorSummary(error),
    })
    return {
      outcome: "failed",
      values: 0,
      row: factsRow(product, "failed", null, writeErrorText(error)),
    }
  }
  const before = Object.fromEntries(Object.keys(values).map((key) => [key, current[key] ?? null]))
  try {
    await hooks.auditProduct(product.id, { template_id: template.id, before, after: values })
  } catch (error) {
    // Written stays written: the entry's failure is logged, not undone
    logger.error({ event: "audit.write_failed", productId: product.id, err: errorSummary(error) })
  }
  const written = writtenText(template, values)
  return {
    outcome: "changed",
    values: Object.keys(values).length,
    row: factsRow(product, "changed", written, left),
  }
}

/** Each product named, a chunk at a time; a report row each, in the order named. */
async function writeAll(
  container: MedusaContainer,
  input: FactsApplyInput,
  given: NamedTemplate | null,
  hooks: FactsRunHooks
) {
  const templates = await readMatchTemplates(container)
  const counts = { changed: 0, unchanged: 0, skipped: 0, failed: 0, values: 0 }
  const rows: SheetCell[][] = []
  const changed: string[] = []
  let done = 0
  for (const chunk of chunksOf(input.product_ids, CHUNK)) {
    const found = new Map(
      (await readFactsProducts(container, chunk, templates)).map((each) => [each.id, each])
    )
    for (const id of chunk) {
      const product = found.get(id)
      const template = product?.template ?? (given ? (templates.get(given.id) ?? null) : null)
      if (!product || !template) {
        counts.skipped += 1
        const key = product ? "description_facts.no_template" : "bulk_edit.product_missing"
        rows.push(
          factsRow(
            product ?? { handle: id, title: null },
            "skipped",
            null,
            serverErrorMessage(key, "tr")
          )
        )
        continue
      }
      const result = await writeOne(container, product, template, input, hooks)
      counts[result.outcome] += 1
      counts.values += result.values
      rows.push(result.row)
      if (result.outcome === "changed") {
        changed.push(product.id)
      }
    }
    done += chunk.length
    await hooks.progress(10 + Math.floor((done / input.product_ids.length) * 90))
  }
  return { counts, rows, changed }
}

export async function runDescriptionFacts(
  container: MedusaContainer,
  input: FactsApplyInput,
  hooks: FactsRunHooks
): Promise<{ summary: FactsRunSummary; rows: SheetCell[][]; templates: TemplateChange[] }> {
  const before = await readMatchTemplates(container)
  const given = input.template_id ? (before.get(input.template_id) ?? null) : null
  if (input.template_id && !given) {
    throw new ValidationError("description_facts.template_unknown", { field: "template_id" })
  }
  await hooks.audit("started", {
    products: input.product_ids.length,
    template_id: input.template_id ?? null,
    overwrite: input.overwrite,
  })
  let finished: Record<string, unknown> = { interrupted: true }
  try {
    const templates = await applyTemplateChanges(container, input.fields, input.aliases)
    for (const change of templates) {
      if (change.added.length > 0 || change.aliased.length > 0) {
        await hooks.audit("template", { ...change })
      }
    }
    await hooks.progress(10)
    const { counts, rows, changed } = await writeAll(container, input, given, hooks)
    const summary: FactsRunSummary = {
      products: input.product_ids.length,
      ...counts,
      fields_added: templates.reduce((sum, each) => sum + each.added.length, 0),
      aliases_added: templates.reduce((sum, each) => sum + each.aliased.length, 0),
    }
    finished = { ...summary, product_ids: changed }
    return { summary, rows, templates }
  } finally {
    await hooks.audit("finished", finished)
  }
}
