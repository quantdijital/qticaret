import type { AttributeInputValue, AttributeType } from "./validation"

/**
 * A value in the column of its type (adr/0013), so facet filters (F3.17)
 * use indexes: text and single choice in `value_text` (btree with the
 * definition), numbers in `value_number`, multiple choice in `value_options`
 * (GIN), yes/no in `value_boolean`.
 */
export interface ValueColumns {
  value_text: string | null
  value_number: number | null
  value_boolean: boolean | null
  value_options: string[] | null
}

const EMPTY: ValueColumns = {
  value_text: null,
  value_number: null,
  value_boolean: null,
  value_options: null,
}

export function toColumns(
  type: AttributeType,
  value: Exclude<AttributeInputValue, null>
): ValueColumns {
  switch (type) {
    case "number":
      return { ...EMPTY, value_number: value as number }
    case "boolean":
      return { ...EMPTY, value_boolean: value as boolean }
    case "multi_select":
      return { ...EMPTY, value_options: value as string[] }
    case "text":
    case "select":
      return { ...EMPTY, value_text: value as string }
  }
}

export interface StoredColumns {
  value_text?: string | null
  value_number?: number | string | null
  value_boolean?: boolean | null
  value_options?: unknown
}

/** A stored value as the API shows it, by its definition's type. */
export function fromColumns(type: AttributeType, row: StoredColumns): AttributeInputValue {
  switch (type) {
    case "number":
      // numeric comes back as a string or a BigNumber-like value
      return row.value_number === null || row.value_number === undefined
        ? null
        : Number(row.value_number)
    case "boolean":
      return row.value_boolean ?? null
    case "multi_select":
      return Array.isArray(row.value_options) ? (row.value_options as string[]) : null
    case "text":
    case "select":
      return row.value_text ?? null
  }
}

export const sameColumns = (a: ValueColumns, b: ValueColumns): boolean =>
  JSON.stringify(a) === JSON.stringify(b)
