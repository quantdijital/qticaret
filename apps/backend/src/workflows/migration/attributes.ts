import type { MedusaContainer } from "@medusajs/framework/types"
import { SHEET_COLUMNS, attributeHeader, attributeValueOf } from "../../lib/catalog-sheet"
import type { SourceProduct } from "../../lib/migration/types"
import { toSlug } from "../../lib/seo/slug"
import type { SheetCell } from "../../lib/sheets"
import { PRODUCT_ATTRIBUTES_MODULE } from "../../modules/product-attributes"
import type ProductAttributesModuleService from "../../modules/product-attributes/service"
import type { AttributeOption, DefinitionShape } from "../../modules/product-attributes/validation"

type Container = Pick<MedusaContainer, "resolve">

/**
 * A product's descriptive attributes as a source gives them (a WordPress
 * export's, adr/0042 Ek 2026-11-03), written to the shop's attribute
 * template through the catalog import's own columns (`Özellik şablonu`,
 * `Özellik: {key}`): the import checks them and its workflow writes them,
 * as it does a sheet's. A field matches an attribute when its key, or its
 * label as a slug, is the attribute's slug (`pa_renk` → `renk`). A value
 * goes as the import reads a cell: a choice must be one of the field's
 * options (none is made here), a text field takes the values joined. A
 * product takes one template: the one that takes most of its attributes
 * and whose required fields it fills. What is not written is reported.
 */

/** A descriptive attribute as a source gives it (WordPress: `ProductAttribute`). */
export interface SourceAttribute {
  /** The source's own key: `pa_renk`. */
  key: string
  /** What a field is matched by: `renk`. */
  slug: string
  name: string
  values: string[]
}

/** A product record that may carry them; a source without them leaves them out. */
export type AttributedProduct = SourceProduct & {
  attributes?: readonly SourceAttribute[] | undefined
}

interface Field extends DefinitionShape {
  label: string
}

/** A template's product fields (a variant field takes no values: it is an option). */
export interface TemplateFields {
  handle: string
  fields: Field[]
}

export interface AttributePlan {
  /** The template the product is given; null: none. */
  template: string | null
  /** A field's key → its cell as the import reads it. */
  cells: Record<string, string>
  /** The source keys of the attributes written. */
  written: string[]
  /** Attributes no template has a field for. */
  unmatched: string[]
  /** Attributes a field matches, with a value it does not take. */
  unfit: string[]
  /** Attributes only a template other than the product's has a field for. */
  elsewhere: string[]
  /** A template takes some, but a field it requires is left empty: none written. */
  requiredMissing: boolean
}

/** The shop's templates with their product fields, by handle. */
export async function attributeTemplates(container: Container): Promise<TemplateFields[]> {
  const templates = await container
    .resolve<ProductAttributesModuleService>(PRODUCT_ATTRIBUTES_MODULE)
    .listAttributeTemplates({}, { relations: ["definitions"], take: null })
  return templates
    .map((template) => ({
      handle: template.handle,
      fields: template.definitions
        .filter((definition) => definition.scope === "product")
        .map((definition) => ({
          key: definition.key,
          label: definition.label,
          type: definition.type,
          scope: definition.scope,
          is_required: definition.is_required,
          options: definition.options as AttributeOption[] | null,
        })),
    }))
    .sort((a, b) => a.handle.localeCompare(b.handle))
}

/** The template's field for the attribute: by its key first, then by its label. */
function fieldFor(template: TemplateFields, attribute: SourceAttribute): Field | undefined {
  return (
    template.fields.find((field) => toSlug(field.key) === attribute.slug) ??
    template.fields.find((field) => toSlug(field.label) === attribute.slug)
  )
}

/** The values as one cell: a multiple choice's joined by `|`, a text's by commas, else one only. */
function cellOf(field: Field, values: readonly string[]): string | null {
  if (field.type === "multi_select") {
    return values.join("|")
  }
  if (field.type === "text") {
    return values.join(", ")
  }
  return values.length === 1 ? (values[0] ?? null) : null
}

/** The cells a template takes; two attributes one field matches (a global one and a product's own) give it their values together. */
function fill(template: TemplateFields, attributes: readonly SourceAttribute[]) {
  const byField = new Map<string, { field: Field; attributes: SourceAttribute[] }>()
  for (const attribute of attributes) {
    const field = fieldFor(template, attribute)
    if (field) {
      const group = byField.get(field.key) ?? { field, attributes: [] }
      group.attributes.push(attribute)
      byField.set(field.key, group)
    }
  }
  const cells: Record<string, string> = {}
  const written: string[] = []
  for (const { field, attributes: own } of byField.values()) {
    const cell = cellOf(field, [...new Set(own.flatMap((attribute) => attribute.values))])
    if (cell !== null && attributeValueOf(field, cell).ok) {
      cells[field.key] = cell
      written.push(...own.map((attribute) => attribute.key))
    }
  }
  const complete = template.fields.every((field) => !field.is_required || field.key in cells)
  return { template, cells, written, complete }
}

/** What of the product's attributes the shop's templates take, and why the rest stay. */
export function planAttributes(
  attributes: readonly SourceAttribute[],
  templates: readonly TemplateFields[]
): AttributePlan {
  const candidates = templates
    .map((template) => fill(template, attributes))
    .filter((candidate) => candidate.written.length > 0)
    .sort((a, b) => b.written.length - a.written.length)
  const chosen = candidates.find((candidate) => candidate.complete)
  const plan: AttributePlan = {
    template: chosen?.template.handle ?? null,
    cells: chosen?.cells ?? {},
    written: chosen?.written ?? [],
    unmatched: [],
    unfit: [],
    elsewhere: [],
    requiredMissing: !chosen && candidates.length > 0,
  }
  for (const attribute of attributes) {
    if (plan.written.includes(attribute.key)) {
      continue
    }
    if (!templates.some((template) => fieldFor(template, attribute))) {
      plan.unmatched.push(attribute.key)
    } else if (chosen && !fieldFor(chosen.template, attribute)) {
      plan.elsewhere.push(attribute.key)
    } else if (!plan.requiredMissing) {
      plan.unfit.push(attribute.key)
    }
  }
  return plan
}

/** Each product's plan by its source key, against the shop's templates as they are now. */
export async function planProductAttributes(
  container: Container,
  products: readonly AttributedProduct[]
): Promise<Map<string, AttributePlan>> {
  const withAttributes = products.filter((product) => (product.attributes?.length ?? 0) > 0)
  const templates = withAttributes.length > 0 ? await attributeTemplates(container) : []
  return new Map(
    withAttributes.map((product) => [
      product.source_key,
      planAttributes(product.attributes ?? [], templates),
    ])
  )
}

const TEMPLATE_COLUMN = SHEET_COLUMNS.findIndex((column) => column.key === "template")

/** The attribute columns the products' plans fill, by key. */
export const attributeColumns = (plans: readonly (AttributePlan | undefined)[]): string[] =>
  [...new Set(plans.flatMap((plan) => Object.keys(plan?.cells ?? {})))].sort()

export const attributeHeaders = (columns: readonly string[]): string[] =>
  columns.map(attributeHeader)

/** A product's sheet rows with its template and values on its first row, as the import reads a product's own cells. */
export function withAttributeCells(
  rows: readonly SheetCell[][],
  plan: AttributePlan | undefined,
  columns: readonly string[]
): SheetCell[][] {
  return rows.map((row, index) => {
    const own = index === 0 && plan?.template ? plan : null
    const cells = [...row]
    if (own) {
      cells[TEMPLATE_COLUMN] = own.template
    }
    return [...cells, ...columns.map((key) => own?.cells[key] ?? null)]
  })
}
