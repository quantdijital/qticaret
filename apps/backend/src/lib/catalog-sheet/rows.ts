import { isCleanText } from "../security"
import type { SheetRow } from "../sheets"
import { toSlug } from "../seo/slug"
import { handleCell, textCell } from "./cells"
import { OPTION_KEYS, cellAt, layoutOf, readHeader } from "./columns"
import type { ColumnKey, SheetLayout } from "./columns"
import { PRODUCT_PARSERS, SHEET_LIMITS, VARIANT_PARSERS } from "./parsers"

export { SHEET_LIMITS } from "./parsers"

/**
 * The sheet's rows as products (F3.9): rows with the same `Tanıtıcı` are
 * one product's variants; a row with none is a new product of one
 * variant, its handle made from its title. A product's own fields come
 * from the first row that fills them; another row filling one otherwise
 * is a problem. An empty cell changes nothing. A product with a problem
 * in any of its rows is left out whole; the problems say where.
 */

export interface SheetProblem {
  line: number
  key: string
  /** The header of the cell, when one cell is wrong. */
  column?: string | undefined
}

export interface ProductFields {
  title?: string
  status?: "draft" | "published"
  description?: string
  /** The short description as plain text (adr/0055 Ek 2026-11-06): one paragraph when written. */
  summary?: string
  categories?: string[]
  collection?: string
  brand?: string
  weight?: number
  length?: number
  width?: number
  height?: number
  seo_title?: string
  seo_description?: string
  focus_keyword?: string
  template?: string
  /** The KDV rate as written: its name or percentage (adr/0007). */
  vat?: string
}

export interface SheetVariant {
  line: number
  /** Option name and value, in the columns' order. */
  options: [string, string][]
  sku?: string
  barcode?: string
  price?: number
  /** Unit cost in lira, VAT excluded (F11.4). */
  cost?: number
  stock?: number
  /**
   * `Takipsiz` in `Stok`: the variant's stock is not counted, so it is
   * always sellable (`manage_inventory: false`; adr/0018 Ek 2026-11-20).
   * Never set together with `stock`.
   */
  untracked?: true
}

export interface SheetProduct {
  handle: string
  /** Made from the title: a new product, its handle made as the panel makes one. */
  isDerived: boolean
  /** Its first row. */
  line: number
  fields: ProductFields
  /** Attribute key → the cell as written; the template's types read it later. */
  attributes: Record<string, string>
  variants: SheetVariant[]
}

/** The product a row belongs to, by handle, else by title; null with a problem. */
function productKey(row: SheetRow, layout: SheetLayout, problems: SheetProblem[]) {
  const given = cellAt(row, layout.columns.handle)
  if (given) {
    const handle = handleCell(given)
    if (!handle.ok) {
      problems.push({ line: row.line, key: handle.key, column: layout.columns.handle?.header })
      return null
    }
    return { handle: handle.value, isDerived: false }
  }
  const handle = toSlug(cellAt(row, layout.columns.title))
  if (!handle) {
    problems.push({ line: row.line, key: "catalog_import.handle_or_title_required" })
    return null
  }
  return { handle, isDerived: true }
}

// The first row to fill a product's field sets it; another value is a conflict
function mergeFields(
  product: SheetProduct,
  row: SheetRow,
  layout: SheetLayout,
  problems: SheetProblem[]
) {
  const fields = product.fields as Record<string, unknown>
  for (const [key, parse] of Object.entries(PRODUCT_PARSERS)) {
    const at = layout.columns[key as ColumnKey]
    const raw = cellAt(row, at)
    if (!raw) {
      continue
    }
    const cell = parse(raw)
    if (!cell.ok) {
      problems.push({ line: row.line, key: cell.key, column: at?.header })
    } else if (fields[key] === undefined) {
      fields[key] = cell.value
    } else if (JSON.stringify(fields[key]) !== JSON.stringify(cell.value)) {
      problems.push({
        line: row.line,
        key: "catalog_import.product_field_conflict",
        column: at?.header,
      })
    }
  }
  for (const attribute of layout.attributes) {
    const raw = cellAt(row, attribute)
    const kept = product.attributes[attribute.key]
    if (raw && kept === undefined) {
      product.attributes[attribute.key] = raw
    } else if (raw && kept !== raw) {
      problems.push({
        line: row.line,
        key: "catalog_import.product_field_conflict",
        column: attribute.header,
      })
    }
  }
}

function variantOf(row: SheetRow, layout: SheetLayout, problems: SheetProblem[]): SheetVariant {
  const variant: SheetVariant = { line: row.line, options: [] }
  for (const [nameKey, valueKey] of OPTION_KEYS) {
    const name = cellAt(row, layout.columns[nameKey])
    const value = cellAt(row, layout.columns[valueKey])
    if (!name && !value) {
      continue
    }
    const named = textCell(name, SHEET_LIMITS.option)
    const valued = textCell(value, SHEET_LIMITS.option)
    if (!name || !value || !named.ok || !valued.ok) {
      problems.push({ line: row.line, key: "catalog_import.option_incomplete" })
      continue
    }
    variant.options.push([named.value, valued.value])
  }
  for (const [key, parse] of Object.entries(VARIANT_PARSERS)) {
    const at = layout.columns[key as keyof typeof VARIANT_PARSERS]
    const raw = cellAt(row, at)
    const cell = raw ? parse(raw) : null
    if (cell && !cell.ok) {
      problems.push({ line: row.line, key: cell.key, column: at?.header })
    } else if (cell?.value === "untracked") {
      variant.untracked = true
    } else if (cell) {
      Object.assign(variant, { [key]: cell.value })
    }
  }
  return variant
}

// One option set per product, each combination once; a SKU once in the file
function checkVariants(product: SheetProduct, skus: Map<string, number>, problems: SheetProblem[]) {
  const names = (variant: SheetVariant) =>
    variant.options.map(([name]) => name.toLocaleLowerCase("tr"))
  const first = JSON.stringify(names(product.variants[0] ?? { line: 0, options: [] }))
  const combinations = new Set<string>()
  for (const variant of product.variants) {
    if (JSON.stringify(names(variant)) !== first) {
      problems.push({ line: variant.line, key: "catalog_import.options_differ" })
    }
    const combination = JSON.stringify(
      variant.options.map(([, value]) => value.toLocaleLowerCase("tr"))
    )
    if (combinations.has(combination)) {
      problems.push({ line: variant.line, key: "catalog_import.variant_repeated" })
    }
    combinations.add(combination)
    const sku = variant.sku?.toLowerCase()
    if (sku && skus.has(sku)) {
      problems.push({ line: variant.line, key: "catalog_import.sku_repeated" })
    }
    if (sku) {
      skus.set(sku, variant.line)
    }
  }
}

export interface SheetProducts {
  /** The products with no problem in any of their rows, in the file's order. */
  products: SheetProduct[]
  problems: SheetProblem[]
  /** Headers the import does not know: their columns are not read. */
  unknownColumns: string[]
  /** Each row's product handle, where the row named one or had a title. */
  handles: Map<number, string>
}

// Headers the import does not know, as the summary lists them: a few, short, clean
const MAX_UNKNOWN_COLUMNS = 20
const listed = (headers: readonly string[]) =>
  headers
    .filter((header) => isCleanText(header))
    .slice(0, MAX_UNKNOWN_COLUMNS)
    .map((header) => header.slice(0, 100))

// The rows by product handle, the handles with a problem, and each row's handle
function groupRows(rows: readonly SheetRow[], layout: SheetLayout, problems: SheetProblem[]) {
  const byHandle = new Map<string, SheetProduct>()
  const failed = new Set<string>()
  const handles = new Map<number, string>()
  for (const row of rows) {
    const before = problems.length
    const key = productKey(row, layout, problems)
    if (!key) {
      continue
    }
    handles.set(row.line, key.handle)
    const known = byHandle.get(key.handle)
    // Rows without a handle are one product each: two titles alike would be one handle
    if (known && (key.isDerived || known.isDerived)) {
      problems.push({ line: row.line, key: "catalog_import.handle_repeated" })
      failed.add(key.handle)
      continue
    }
    const product = known ?? { ...key, line: row.line, fields: {}, attributes: {}, variants: [] }
    byHandle.set(key.handle, product)
    mergeFields(product, row, layout, problems)
    product.variants.push(variantOf(row, layout, problems))
    if (problems.length > before) {
      failed.add(key.handle)
    }
  }
  return { byHandle, failed, handles }
}

/** The sheet's header and rows as products, and what is wrong with the rest. */
export function productsOf(header: readonly string[], rows: readonly SheetRow[]): SheetProducts {
  const read = readHeader(header)
  const problems: SheetProblem[] = read.repeated.map((column) => ({
    line: 1,
    key: "catalog_import.column_repeated",
    column,
  }))
  const unknownColumns = listed(read.unknown)
  const layout = layoutOf(header, read.columns)
  if (!layout.columns.handle && !layout.columns.title) {
    problems.push({ line: 1, key: "catalog_import.columns_missing" })
    return { products: [], problems, unknownColumns, handles: new Map() }
  }
  const { byHandle, failed, handles } = groupRows(rows, layout, problems)
  const skus = new Map<string, number>()
  for (const product of byHandle.values()) {
    const before = problems.length
    checkVariants(product, skus, problems)
    if (problems.length > before) {
      failed.add(product.handle)
    }
  }
  return {
    products: [...byHandle.values()].filter((product) => !failed.has(product.handle)),
    problems: problems.sort((a, b) => a.line - b.line),
    unknownColumns,
    handles,
  }
}
