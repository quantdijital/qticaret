import { z } from "@medusajs/framework/zod"
import { isCleanText } from "../../lib/security/text"
import { isReservedParam } from "../../lib/seo/facets"
import { ATTRIBUTE_TYPES, VARIES_BY } from "./models/attribute-definition"

/**
 * Rules for attribute definitions and the values products give them
 * (adr/0013). Messages are i18n keys the API returns as they are.
 */

export type AttributeType = (typeof ATTRIBUTE_TYPES)[number]

export interface AttributeOption {
  value: string
  label: string
}

const KEY = /^[a-z][a-z0-9_]{0,63}$/
// Keys become object keys; one an object already has (`constructor`) would
// read the prototype where a value is missing
const isFreeKey = (key: string): boolean => !(key in Object.prototype)
// Option values end up in facet URLs (F3.17): slug-like only
const OPTION_VALUE = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/
// Under Postgres's btree row limit even in 4-byte characters: the
// (definition, value_text) index refuses longer rows
const MAX_TEXT_VALUE = 500
const MAX_OPTIONS = 200

const cleanText = { message: "product_attributes.text_invalid" }
const text = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((value) => isCleanText(value), cleanText)

const option = z
  .object({
    value: z
      .string()
      .max(100)
      .regex(OPTION_VALUE, { message: "product_attributes.option_value_invalid" }),
    label: text(200),
  })
  .strict()

/** A definition as the admin sends it; `id` names one to change. */
export const definitionInput = z
  .object({
    id: z.string().max(64).optional(),
    key: z
      .string()
      .regex(KEY, { message: "product_attributes.key_invalid" })
      .refine(isFreeKey, { message: "product_attributes.key_invalid" }),
    label: text(200),
    type: z.enum(ATTRIBUTE_TYPES),
    unit: text(32).nullable().optional(),
    options: z.array(option).max(MAX_OPTIONS).nullable().optional(),
    rank: z.number().int().min(0).max(10_000).optional(),
    is_required: z.boolean().optional(),
    is_filterable: z.boolean().optional(),
    is_seo_highlight: z.boolean().optional(),
    is_public: z.boolean().optional(),
    scope: z.enum(["product", "variant"]).optional(),
    option_title: text(200).nullable().optional(),
    varies_by: z.enum(VARIES_BY).nullable().optional(),
  })
  .strict()
  .superRefine((definition, ctx) => {
    const issue = (message: string, path: string) => {
      ctx.addIssue({ code: "custom", message, path: [path] })
    }
    const isSelect = definition.type === "select" || definition.type === "multi_select"
    const values = (definition.options ?? []).map((item) => item.value)
    if (isSelect && values.length === 0) {
      issue("product_attributes.options_required", "options")
    }
    if (!isSelect && values.length > 0) {
      issue("product_attributes.options_not_allowed", "options")
    }
    if (new Set(values).size !== values.length) {
      issue("product_attributes.options_duplicate", "options")
    }
    // A filterable choice is a listing's URL parameter (F3.17): its name must be free there
    if (isSelect && definition.is_filterable && isReservedParam(definition.key)) {
      issue("product_attributes.key_reserved", "key")
    }
    const variant = definition.scope === "variant"
    // A hidden attribute is never a filter, a title's word or a product option, all shown
    if (
      definition.is_public === false &&
      (definition.is_filterable || definition.is_seo_highlight || variant)
    ) {
      issue("product_attributes.private_shown", "is_public")
    }
    if (variant && !definition.option_title) {
      issue("product_attributes.option_title_required", "option_title")
    }
    if (!variant && (definition.varies_by || definition.option_title)) {
      issue("product_attributes.variant_only", "varies_by")
    }
  })

export type DefinitionInput = z.infer<typeof definitionInput>

/** Keys must be unique within a template. */
export function duplicateKeys(definitions: readonly { key: string }[]): string[] {
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const { key } of definitions) {
    if (seen.has(key)) {
      duplicates.add(key)
    }
    seen.add(key)
  }
  return [...duplicates]
}

export interface DefinitionShape {
  key: string
  type: AttributeType
  scope: "product" | "variant"
  is_required: boolean
  options: AttributeOption[] | null
}

export type AttributeInputValue = string | number | boolean | string[] | null

function valueSchema(definition: DefinitionShape): z.ZodType {
  const allowed = (definition.options ?? []).map((item) => item.value)
  const inOptions = (value: string) => allowed.includes(value)
  switch (definition.type) {
    case "text":
      return text(MAX_TEXT_VALUE)
    case "number":
      // Zod 4 refuses Infinity and NaN itself
      return z.number()
    case "boolean":
      return z.boolean()
    case "select":
      return z.string().refine(inOptions, { message: "product_attributes.option_unknown" })
    case "multi_select":
      return z
        .array(z.string().refine(inOptions, { message: "product_attributes.option_unknown" }))
        .min(1)
        .max(MAX_OPTIONS)
        .refine((items) => new Set(items).size === items.length, {
          message: "product_attributes.options_duplicate",
        })
  }
}

/**
 * The schema for a product's values under a template: one optional field
 * per product-scope definition (null clears it), required ones present and
 * not null, no other keys. Variant attributes take no values here.
 */
export function productValuesSchema(definitions: readonly DefinitionShape[]) {
  const fields = Object.fromEntries(
    definitions
      .filter((definition) => definition.scope === "product")
      .map((definition) => {
        const schema = valueSchema(definition)
        return [definition.key, definition.is_required ? schema : schema.nullable().optional()]
      })
  )
  return z.object(fields).strict()
}
