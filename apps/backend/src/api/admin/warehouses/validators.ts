import { z } from "@medusajs/framework/zod"
import { isCleanText } from "../../../lib/security"

// One line of text: no control characters (they break labels and CSV exports)
const line = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .refine((value) => isCleanText(value), "stock.text_invalid")

const optionalLine = (max: number) =>
  line(max)
    .transform((value) => value || null)
    .nullable()
    .optional()

/**
 * A warehouse's address; a Turkish one is checked against the reference
 * data after this (F1.4). Empty fields clear the stored value.
 */
const address = z
  .object({
    address_1: line(200).pipe(z.string().min(1)),
    address_2: optionalLine(200),
    city: optionalLine(100),
    province: optionalLine(100),
    postal_code: optionalLine(10),
    phone: optionalLine(30),
    country_code: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z]{2}$/),
  })
  .strict()

const name = line(100).pipe(z.string().min(1))

export const AdminCreateWarehouse = z.object({ name, address }).strict()
export type AdminCreateWarehouseType = z.infer<typeof AdminCreateWarehouse>

export const AdminUpdateWarehouse = z.object({ name, address: address.optional() }).strict()
export type AdminUpdateWarehouseType = z.infer<typeof AdminUpdateWarehouse>
