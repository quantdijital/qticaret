import { z } from "@medusajs/framework/zod"

const name = z.string().trim().min(1).max(100)
/** Off every variant's own price, as a price list's percentage (adr/0010: two decimals). */
const percent = z.number().multipleOf(0.01).min(0.01).max(99)
/** Fewest units an order holds (ADR-0068 §8). */
const minQuantity = z.number().int().min(1).max(100_000)

/** A new wholesale level: its name, and optionally a rate and the fewest units. */
export const AdminPostWholesaleTier = z
  .object({
    name,
    percent: percent.nullable().default(null),
    min_quantity: minQuantity.nullable().default(null),
  })
  .strict()
export type AdminPostWholesaleTierType = z.infer<typeof AdminPostWholesaleTier>

/** A level changed: null takes a rate or a minimum away. */
export const AdminUpdateWholesaleTier = z
  .object({
    name: name.optional(),
    percent: percent.nullable().optional(),
    min_quantity: minQuantity.nullable().optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0)
export type AdminUpdateWholesaleTierType = z.infer<typeof AdminUpdateWholesaleTier>

/** Lira with up to two decimals, as Medusa writes amounts ("1250.50"); never zero. */
const netAmount = z
  .string()
  .regex(/^\d{1,9}(\.\d{1,2})?$/)
  .refine((value) => Number(value) > 0)

const variantId = z.string().min(1).max(100)

/** Prices entered by hand, KDV excluded; at most 100 variants a request. */
export const AdminPostWholesalePrices = z
  .object({
    set: z
      .array(z.object({ variant_id: variantId, net: netAmount }).strict())
      .max(100)
      .default([]),
    remove: z.array(variantId).max(100).default([]),
  })
  .strict()
  .refine((body) => body.set.length + body.remove.length > 0)
  .refine((body) => {
    const ids = [...body.set.map((each) => each.variant_id), ...body.remove]
    return new Set(ids).size === ids.length
  })
export type AdminPostWholesalePricesType = z.infer<typeof AdminPostWholesalePrices>
