import type { AttributeOption, AttributeType, AttributeValue } from "@/features/attributes/types"

/** The facts preview's shapes (`POST /admin/description-facts/preview`, adr/0013 Ek 2026-11-05). */

export type FactStatus =
  "ready" | "same" | "filled" | "unparsed" | "conflict" | "ambiguous" | "unmatched"

export type FactReason = "number" | "range" | "unit" | "option" | "boolean" | "text"

export interface FactRow {
  label: string
  value: string
  source_path: string
  context?: string
  unit?: string
  status: FactStatus
  field?: string
  fields?: string[]
  value_parsed?: Exclude<AttributeValue, null>
  current?: AttributeValue
  reason?: FactReason
  group?: string | null
}

export interface FactsProductPreview {
  id: string
  title: string
  template_id: string | null
  template_given: boolean
  source: "doc" | "html" | "text" | null
  rows: FactRow[]
}

export interface FieldSuggestion {
  name: string
  label: string
  key: string
  type: AttributeType
  unit: string | null
  options: AttributeOption[] | null
  group: string | null
  products: number
  values: string[]
}

export type FactsCounts = Record<FactStatus, number> & {
  products: number
  with_facts: number
  no_template: number
}

export interface FactsPreview {
  products: FactsProductPreview[]
  suggestions: { template_id: string; fields: FieldSuggestion[] }[]
  counts: FactsCounts
  suggested_template_id: string | null
}

/** What the run reports when it ends (`catalog.description_facts`). */
export interface FactsSummary {
  products: number
  changed: number
  unchanged: number
  skipped: number
  failed: number
  values: number
  fields_added: number
  aliases_added: number
}
