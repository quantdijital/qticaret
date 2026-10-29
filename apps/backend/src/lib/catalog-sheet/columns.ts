import { toSlug } from "../seo/slug"
import type { SheetRow } from "../sheets"

/**
 * The product sheet's columns (F3.9, adr/0018): one row per variant, rows
 * with the same `Tanıtıcı` one product. Headers are the template's Turkish
 * names; a header is matched by its words (case, Turkish letters and the
 * unit in brackets aside) or by the column's key, so `Ağırlık (kg)`,
 * `agirlik` and `weight` are one column. An attribute is a column of its
 * own, `Özellik: {key}`. The export writes the same columns, so an export
 * edited and uploaded again is an import.
 */

export const OPTION_COUNT = 3

export type ColumnKey =
  | "handle"
  | "title"
  | "status"
  | "description"
  | "categories"
  | "collection"
  | "brand"
  | "weight"
  | "length"
  | "width"
  | "height"
  | "seo_title"
  | "seo_description"
  | "focus_keyword"
  | "template"
  | `option${1 | 2 | 3}_name`
  | `option${1 | 2 | 3}_value`
  | "sku"
  | "barcode"
  | "price"
  | "cost"
  | "stock"

export interface ColumnSpec {
  key: ColumnKey
  header: string
  /** A product's own (the product's first row is read), or a variant's (every row). */
  scope: "product" | "variant"
  /** In characters, for the template and the export. */
  width: number
  /** Shown in brackets after the header. */
  unit?: "weight" | "dimension" | "currency"
}

/** Each option's name and value columns, in order. */
export const OPTION_KEYS = [
  ["option1_name", "option1_value"],
  ["option2_name", "option2_value"],
  ["option3_name", "option3_value"],
] as const satisfies readonly (readonly [ColumnKey, ColumnKey])[]

const option = (n: 1 | 2 | 3): ColumnSpec[] => {
  const [name, value] = OPTION_KEYS[n - 1] ?? OPTION_KEYS[0]
  return [
    { key: name, header: `Seçenek ${String(n)} adı`, scope: "variant", width: 14 },
    { key: value, header: `Seçenek ${String(n)} değeri`, scope: "variant", width: 14 },
  ]
}

export const SHEET_COLUMNS: readonly ColumnSpec[] = [
  { key: "handle", header: "Tanıtıcı", scope: "product", width: 28 },
  { key: "title", header: "Ürün adı", scope: "product", width: 36 },
  { key: "status", header: "Durum", scope: "product", width: 10 },
  { key: "description", header: "Açıklama", scope: "product", width: 48 },
  { key: "categories", header: "Kategoriler", scope: "product", width: 28 },
  { key: "collection", header: "Koleksiyon", scope: "product", width: 18 },
  { key: "brand", header: "Marka", scope: "product", width: 18 },
  { key: "weight", header: "Ağırlık", scope: "product", width: 10, unit: "weight" },
  { key: "length", header: "Uzunluk", scope: "product", width: 10, unit: "dimension" },
  { key: "width", header: "Genişlik", scope: "product", width: 10, unit: "dimension" },
  { key: "height", header: "Yükseklik", scope: "product", width: 10, unit: "dimension" },
  { key: "seo_title", header: "SEO başlığı", scope: "product", width: 36 },
  { key: "seo_description", header: "SEO açıklaması", scope: "product", width: 48 },
  { key: "focus_keyword", header: "Odak kelime", scope: "product", width: 18 },
  { key: "template", header: "Özellik şablonu", scope: "product", width: 18 },
  ...option(1),
  ...option(2),
  ...option(3),
  { key: "sku", header: "SKU", scope: "variant", width: 16 },
  { key: "barcode", header: "Barkod", scope: "variant", width: 16 },
  { key: "price", header: "Fiyat", scope: "variant", width: 12, unit: "currency" },
  // F11.4: the unit cost, VAT excluded; staff only, never in a feed
  { key: "cost", header: "Maliyet", scope: "variant", width: 12, unit: "currency" },
  { key: "stock", header: "Stok", scope: "variant", width: 8 },
]

export interface SheetUnits {
  weight: "g" | "kg"
  dimension: "cm" | "mm"
}

/** The column's header as the template writes it: `Ağırlık (g)`, `Fiyat (TRY)`. */
export function headerOf(column: ColumnSpec, units: SheetUnits): string {
  const unit =
    column.unit === "weight"
      ? units.weight
      : column.unit === "dimension"
        ? units.dimension
        : column.unit === "currency"
          ? "TRY"
          : null
  return unit ? `${column.header} (${unit})` : column.header
}

export const ATTRIBUTE_PREFIX = "Özellik:"
export const attributeHeader = (key: string): string => `${ATTRIBUTE_PREFIX} ${key}`

export type ColumnRef = { kind: "column"; spec: ColumnSpec } | { kind: "attribute"; key: string }

// Words only: `Ağırlık (kg)` → `agirlik`, `seo_title` → `seo-title`
const words = (header: string): string =>
  toSlug(header.replace(/\([^)]*\)/g, " ").replace(/_/g, " "))

const BY_WORDS = new Map(
  SHEET_COLUMNS.flatMap((spec) => [
    [words(spec.header), spec],
    [words(spec.key), spec],
  ])
)
const ATTRIBUTE = /^\s*özellik\s*:\s*(\S.*?)\s*$/i

export interface ReadHeader {
  /** By the file's column order; null for a column the import does not read. */
  columns: (ColumnRef | null)[]
  /** Headers named twice (the second is not read). */
  repeated: string[]
  unknown: string[]
}

/** Which of the file's columns are which. */
export function readHeader(header: readonly string[]): ReadHeader {
  const seen = new Set<string>()
  const repeated: string[] = []
  const unknown: string[] = []
  const columns = header.map((text): ColumnRef | null => {
    if (text.trim() === "") {
      return null
    }
    const attribute = ATTRIBUTE.exec(text.toLocaleLowerCase("tr"))?.[1]
    const spec = attribute ? undefined : BY_WORDS.get(words(text))
    const ref: ColumnRef | null = attribute
      ? { kind: "attribute", key: attribute }
      : spec
        ? { kind: "column", spec }
        : null
    if (!ref) {
      unknown.push(text)
      return null
    }
    const id = ref.kind === "attribute" ? `attribute:${ref.key}` : ref.spec.key
    if (seen.has(id)) {
      repeated.push(text)
      return null
    }
    seen.add(id)
    return ref
  })
  return { columns, repeated, unknown }
}

export interface Located {
  index: number
  header: string
}

/** The file's columns by what they are. */
export interface SheetLayout {
  columns: Partial<Record<ColumnKey, Located>>
  attributes: (Located & { key: string })[]
}

export function layoutOf(
  header: readonly string[],
  refs: readonly (ColumnRef | null)[]
): SheetLayout {
  const layout: SheetLayout = { columns: {}, attributes: [] }
  refs.forEach((ref, index) => {
    const located = { index, header: header[index] ?? "" }
    if (ref?.kind === "column") {
      layout.columns[ref.spec.key] = located
    } else if (ref?.kind === "attribute") {
      layout.attributes.push({ ...located, key: ref.key })
    }
  })
  return layout
}

export const cellAt = (row: SheetRow, at: Located | undefined): string =>
  at ? (row.cells[at.index] ?? "").trim() : ""
