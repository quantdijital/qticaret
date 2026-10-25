/** Product attribute API shapes (adr/0013), as the panel reads them. */

export type AttributeType = "text" | "number" | "boolean" | "select" | "multi_select"

export interface AttributeOption {
  value: string
  label: string
}

export interface AttributeDefinition {
  id: string
  key: string
  label: string
  type: AttributeType
  unit: string | null
  options: AttributeOption[] | null
  rank: number
  is_required: boolean
  is_filterable: boolean
  is_seo_highlight: boolean
  scope: "product" | "variant"
  option_title: string | null
  varies_by: string | null
}

export interface AttributeTemplate {
  id: string
  name: string
  handle: string
  description: string | null
  definitions: AttributeDefinition[]
}

export type AttributeValue = string | number | boolean | string[] | null

export interface ProductAttributes {
  template: AttributeTemplate | null
  values: Record<string, AttributeValue>
}

export const ATTRIBUTE_TYPES: readonly AttributeType[] = [
  "text",
  "number",
  "boolean",
  "select",
  "multi_select",
]

// The only values Google reads in variesBy (docs/13 §2.3)
export const VARIES_BY = [
  "color",
  "size",
  "suggestedAge",
  "suggestedGender",
  "material",
  "pattern",
] as const

export const isSelectType = (type: AttributeType): boolean =>
  type === "select" || type === "multi_select"
