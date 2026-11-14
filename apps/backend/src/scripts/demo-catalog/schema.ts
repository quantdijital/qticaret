import { z } from "@medusajs/framework/zod"

/**
 * A demo catalogue as a data file (`load-demo-catalog`): the loader knows
 * no sector, everything a shop sells is in the file. Handles follow
 * docs/13 slug rules; prices are gross TRY amounts (KDV included,
 * adr/0007); weight and measures are in the store's units (g, cm).
 */
const handle = z
  .string()
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)

/** A file in the data file's `images` folder: a bare name, never a path. */
const imageFile = z.string().regex(/^[a-z0-9][a-z0-9._-]*\.(?:jpe?g|png|webp)$/i)

const attributeValue = z.union([z.string(), z.number(), z.boolean(), z.array(z.string())])

const variantSchema = z.object({
  /** One value per option title. */
  options: z.record(z.string(), z.string()),
  price: z.number().positive(),
  /** Below the price: goes into the file's sale price list. */
  sale_price: z.number().positive().optional(),
  stock: z.number().int().min(0).default(25),
})

const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().nullable().default(null),
  body: z.string().min(1),
  author: z.string().min(1),
  date: z.coerce.date(),
})

const productSchema = z.object({
  handle,
  title: z.string().min(1),
  description: z.string().min(1),
  /** The short text under the product's name. */
  summary: z.string().optional(),
  /** Category handles; the first is the primary one. */
  categories: z.array(handle).min(1),
  brand: handle.optional(),
  /** VAT product type (adr/0007); left out means the default rate. */
  vat_type: z.string().optional(),
  /** Attribute template handle, with values by definition key. */
  template: handle.optional(),
  attributes: z.record(z.string(), attributeValue).default({}),
  dimensions: z.object({
    weight: z.number().positive(),
    length: z.number().positive(),
    width: z.number().positive(),
    height: z.number().positive(),
  }),
  options: z
    .array(z.object({ title: z.string().min(1), values: z.array(z.string()).min(1) }))
    .min(1),
  variants: z.array(variantSchema).min(1),
  images: z.array(imageFile).default([]),
  reviews: z.array(reviewSchema).default([]),
})

const categorySchema = z.object({
  handle,
  name: z.string().min(1),
  parent: handle.optional(),
  description: z.string().optional(),
  image: imageFile.optional(),
  image_alt: z.string().optional(),
})

const brandSchema = z.object({
  handle,
  name: z.string().min(1),
  description: z.string().nullable().default(null),
})

export const demoCatalogSchema = z.object({
  /** Names the catalogue: the mark on what it makes, and its reviews' source. */
  name: handle,
  /** Records taken off the storefront (unpublished, never deleted). */
  hide: z
    .object({ products: z.array(handle).default([]), categories: z.array(handle).default([]) })
    .default({ products: [], categories: [] }),
  /** The price list the variants' `sale_price`s go into. */
  sale: z.object({ title: z.string().min(1), description: z.string().default("") }).optional(),
  brands: z.array(brandSchema).default([]),
  /** Parents before their children. */
  categories: z.array(categorySchema).default([]),
  products: z.array(productSchema).default([]),
})

export type DemoCatalog = z.infer<typeof demoCatalogSchema>
export type DemoCatalogProduct = DemoCatalog["products"][number]
export type DemoCatalogCategory = DemoCatalog["categories"][number]
