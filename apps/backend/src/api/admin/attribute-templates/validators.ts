import { z } from "@medusajs/framework/zod"
import {
  MAX_OPTIONS,
  MAX_TEXT_VALUE,
  definitionInput,
  groupsInput,
  optionInput,
} from "../../../modules/product-attributes/validation"

const HANDLE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const MAX_DEFINITIONS = 100

const definitions = z.array(definitionInput).max(MAX_DEFINITIONS)

/**
 * A template; `groups` are its spec table's sections (adr/0013 Ek
 * 2026-11-04), each definition naming one by `group`.
 */
export const AdminPostAttributeTemplate = z
  .object({
    name: z.string().trim().min(1).max(200),
    handle: z.string().max(100).regex(HANDLE, { message: "product_attributes.handle_invalid" }),
    description: z.string().trim().max(1000).nullable().optional(),
    groups: groupsInput.optional(),
    definitions: definitions.default([]),
  })
  .strict()
export type AdminPostAttributeTemplateType = z.infer<typeof AdminPostAttributeTemplate>

export const AdminUpdateAttributeTemplate = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(1000).nullable().optional(),
    /** The full list of sections; left out: as they are. */
    groups: groupsInput.optional(),
    definitions: definitions.optional(),
    confirm_delete_values: z.boolean().optional(),
  })
  .strict()
export type AdminUpdateAttributeTemplateType = z.infer<typeof AdminUpdateAttributeTemplate>

export const AdminGetAttributeTemplates = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
})
export type AdminGetAttributeTemplatesType = z.infer<typeof AdminGetAttributeTemplates>

// More distinct texts than a shop's catalogue holds for one field
const MAX_MAPPING = 1_000

/**
 * A text attribute turned into a single choice (adr/0013 Ek 2026-11-05):
 * the options, and what each stored text becomes, an option's value or
 * `null` to clear it. `is_filterable` left out: as it was.
 */
export const AdminPostConvertDefinition = z
  .object({
    options: z.array(optionInput).min(1).max(MAX_OPTIONS),
    mapping: z
      .array(
        z
          .object({
            from: z.string().min(1).max(MAX_TEXT_VALUE),
            to: optionInput.shape.value.nullable(),
          })
          .strict()
      )
      .max(MAX_MAPPING),
    is_filterable: z.boolean().optional(),
  })
  .strict()
export type AdminPostConvertDefinitionType = z.infer<typeof AdminPostConvertDefinition>
