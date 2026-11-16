import { z } from "@medusajs/framework/zod"

const page = {
  q: z.string().trim().max(200).optional(),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(25),
}

/** `?q=&active=true&offset=&limit=`: brands by name. */
export const AdminGetBrands = z
  .object({ ...page, active: z.enum(["true", "false"]).optional() })
  .strict()
export type AdminGetBrandsType = z.infer<typeof AdminGetBrands>

/**
 * A stored file's key: no path out of storage's folder (a `..` segment, a
 * leading slash). Keys storage makes never hold one; a folder inside one
 * (`klasor/logo-01J.png`) stays allowed.
 */
const fileKey = z
  .string()
  .max(64)
  .refine((key) => !/^[\\/]/.test(key) && !/(^|[\\/])\.\.([\\/]|$)/.test(key))

// Shape and size only; names, handles and logos are checked in the workflow
const fields = {
  name: z.string().max(500),
  handle: z.string().max(200).optional(),
  description: z.string().max(20_000).nullable().optional(),
  logo_file_id: fileKey.nullable().optional(),
  is_active: z.boolean().optional(),
}

export const AdminPostBrand = z.object(fields).strict()
export type AdminPostBrandType = z.infer<typeof AdminPostBrand>

export const AdminUpdateBrand = z.object({ ...fields, name: fields.name.optional() }).strict()
export type AdminUpdateBrandType = z.infer<typeof AdminUpdateBrand>

/** A product's brand; null takes it off. */
export const AdminPostProductBrand = z.object({ brand_id: z.string().max(64).nullable() }).strict()
export type AdminPostProductBrandType = z.infer<typeof AdminPostProductBrand>
