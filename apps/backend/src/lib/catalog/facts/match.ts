import type {
  AttributeInputValue,
  AttributeOption,
  AttributeType,
} from "../../../modules/product-attributes/validation"
import type { FactRow } from "./extract"
import { parseValue, sameValue } from "./parse"
import type { ParseFailure } from "./parse"
import { labelKey } from "./text"

/**
 * A product's facts matched to its template's fields (adr/0013 Ek
 * 2026-11-05). A row names a field when its label, folded as `labelKey`
 * does (Turkish case rules, accents and punctuation off), is the field's
 * label, its key or one of its other names (`aliases`); a label that names
 * two fields is told apart by the row's section (a field's group). Its
 * value is then read by the field's type. Nothing is matched by guess: a
 * label that names no field is offered as a new one, never made here.
 */

export interface MatchField {
  key: string
  label: string
  type: AttributeType
  unit: string | null
  options: AttributeOption[] | null
  scope: "product" | "variant"
  group?: string | null | undefined
  aliases?: readonly string[] | null | undefined
  is_required?: boolean | undefined
}

export interface MatchTemplate {
  id: string
  groups?: readonly { key: string; name: string }[] | null | undefined
  definitions: readonly MatchField[]
}

export type RowStatus =
  /** Empty in the product: written. */
  | "ready"
  /** The product holds this value already. */
  | "same"
  /** The product holds another value: written only when asked to write over. */
  | "filled"
  /** The value does not read as the field's type. */
  | "unparsed"
  /** Another row gives the field another value: neither is written. */
  | "conflict"
  /** The label names more than one field. */
  | "ambiguous"
  /** The label names no field. */
  | "unmatched"

export interface MatchedRow extends FactRow {
  status: RowStatus
  /** The field's key (all but `ambiguous` and `unmatched`). */
  field?: string
  /** The fields an ambiguous label names. */
  fields?: string[]
  value_parsed?: Exclude<AttributeInputValue, null>
  current?: AttributeInputValue
  reason?: ParseFailure
}

/** The names a field answers to, folded. */
export function fieldNames(field: MatchField, groupName: string | null): string[] {
  const names = [field.label, field.key.replace(/_/g, " "), ...(field.aliases ?? [])]
  return [
    ...names.map(labelKey),
    ...(groupName ? [labelKey(`${groupName} ${field.label}`)] : []),
  ].filter((name) => name !== "")
}

/** The names a row's label can be read as. */
const rowNames = (row: FactRow): string[] =>
  [labelKey(row.label), ...(row.context ? [labelKey(`${row.context} ${row.label}`)] : [])].filter(
    (name) => name !== ""
  )

/** The product-scope fields a row's label names (a variant's values are its options). */
export function fieldsFor(row: FactRow, template: MatchTemplate): MatchField[] {
  const groupName = (key: string | null | undefined) =>
    (template.groups ?? []).find((group) => group.key === key)?.name ?? null
  const names = new Set(rowNames(row))
  const found = template.definitions.filter(
    (field) =>
      field.scope === "product" &&
      fieldNames(field, groupName(field.group)).some((name) => names.has(name))
  )
  if (found.length <= 1 || !row.context) {
    return found
  }
  // Two fields of one name: the one in the row's section
  const context = labelKey(row.context)
  const inSection = found.filter((field) => labelKey(groupName(field.group) ?? "") === context)
  return inSection.length === 1 ? inSection : found
}

/**
 * Each row with what becomes of it against the template and the product's
 * current values (by field key).
 */
export function matchFacts(
  rows: readonly FactRow[],
  template: MatchTemplate,
  current: Readonly<Record<string, AttributeInputValue>>
): MatchedRow[] {
  const matched: MatchedRow[] = rows.map((row) => {
    const fields = fieldsFor(row, template)
    const [field] = fields
    if (!field) {
      return { ...row, status: "unmatched" }
    }
    if (fields.length > 1) {
      return { ...row, status: "ambiguous", fields: fields.map((each) => each.key) }
    }
    const parsed = parseValue(field, row.value, row.unit ?? null)
    if (!parsed.ok) {
      return { ...row, status: "unparsed", field: field.key, reason: parsed.reason }
    }
    const now = Object.hasOwn(current, field.key) ? current[field.key] : undefined
    const status: RowStatus =
      now === undefined || now === null ? "ready" : sameValue(now, parsed.value) ? "same" : "filled"
    return {
      ...row,
      status,
      field: field.key,
      value_parsed: parsed.value,
      ...(now === undefined || now === null ? {} : { current: now }),
    }
  })
  // Two rows that give one field two values: neither is taken
  const byField = new Map<string, MatchedRow[]>()
  for (const row of matched) {
    if (row.field && row.value_parsed !== undefined) {
      byField.set(row.field, [...(byField.get(row.field) ?? []), row])
    }
  }
  for (const group of byField.values()) {
    const [first] = group
    if (first && group.some((row) => !sameValue(row.value_parsed, first.value_parsed))) {
      group.forEach((row) => (row.status = "conflict"))
    }
  }
  return matched
}

/**
 * The values to write, by field key: each field's once, from rows that
 * are `ready`, and `filled` ones when asked to write over.
 */
export function valuesToWrite(
  rows: readonly MatchedRow[],
  overwrite: boolean
): Record<string, Exclude<AttributeInputValue, null>> {
  const values: Record<string, Exclude<AttributeInputValue, null>> = {}
  for (const row of rows) {
    const take = row.status === "ready" || (overwrite && row.status === "filled")
    if (take && row.field && row.value_parsed !== undefined && !Object.hasOwn(values, row.field)) {
      values[row.field] = row.value_parsed
    }
  }
  return values
}
