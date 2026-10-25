import { z } from "@medusajs/framework/zod"
import { definitionInput } from "../../../modules/product-attributes/validation"

const HANDLE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const MAX_DEFINITIONS = 100

const definitions = z.array(definitionInput).max(MAX_DEFINITIONS)

export const AdminPostAttributeTemplate = z
  .object({
    name: z.string().trim().min(1).max(200),
    handle: z.string().max(100).regex(HANDLE, { message: "product_attributes.handle_invalid" }),
    description: z.string().trim().max(1000).nullable().optional(),
    definitions: definitions.default([]),
  })
  .strict()
export type AdminPostAttributeTemplateType = z.infer<typeof AdminPostAttributeTemplate>

export const AdminUpdateAttributeTemplate = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(1000).nullable().optional(),
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
