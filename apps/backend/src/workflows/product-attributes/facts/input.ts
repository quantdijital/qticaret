import { z } from "@medusajs/framework/zod"
import { ATTRIBUTE_TYPES } from "../../../modules/product-attributes/models/attribute-definition"

/**
 * What the panel sends to preview and write the facts in products'
 * descriptions (adr/0013 Ek 2026-11-05). Each new field and other name is
 * checked again by the template's own rules when it is written.
 */

/** Products one preview or run takes: as many as a bulk edit. */
export const MAX_FACTS_PRODUCTS = 1000

const id = z.string().min(1).max(64)

const products = {
  product_ids: z
    .array(id)
    .min(1)
    .max(MAX_FACTS_PRODUCTS)
    .refine((ids) => new Set(ids).size === ids.length),
  /** Given to the products without a template; none: those are left. */
  template_id: id.nullable().optional(),
}

export const FactsPreviewInput = z.object(products).strict()
export type FactsPreviewInput = z.infer<typeof FactsPreviewInput>

/** A label the template's fields do not name, added as a field of its own. */
export const FactsFieldInput = z
  .object({
    template_id: id,
    label: z.string().trim().min(1).max(200),
    type: z.enum(ATTRIBUTE_TYPES),
    unit: z.string().trim().min(1).max(32).nullable().optional(),
    options: z
      .array(z.object({ value: z.string().max(100), label: z.string().max(200) }).strict())
      .max(200)
      .nullable()
      .optional(),
    /** The template's section it goes in. */
    group: z.string().max(40).nullable().optional(),
  })
  .strict()
export type FactsFieldInput = z.infer<typeof FactsFieldInput>

/** A label kept as another name of a field the template has. */
export const FactsAliasInput = z
  .object({
    template_id: id,
    key: z.string().min(1).max(64),
    label: z.string().trim().min(1).max(100),
  })
  .strict()
export type FactsAliasInput = z.infer<typeof FactsAliasInput>

export const FactsApplyInput = z
  .object({
    ...products,
    /** Values the products hold are replaced by the description's. */
    overwrite: z.boolean().default(false),
    fields: z.array(FactsFieldInput).max(100).default([]),
    aliases: z.array(FactsAliasInput).max(100).default([]),
  })
  .strict()
export type FactsApplyInput = z.infer<typeof FactsApplyInput>
