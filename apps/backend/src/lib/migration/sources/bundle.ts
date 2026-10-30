import { z } from "@medusajs/framework/zod"
import { ValidationError } from "../../errors"
import type { MigrationSource } from "../types"

/**
 * A migration bundle (F14, adr/0042 §1): a shop's data already in the
 * common records, as one JSON file. For a platform without a ready source,
 * prepared outside and checked here as strictly as any source's records.
 * The file is read whole: its size is capped where it is uploaded.
 */

export const BUNDLE_FORMAT = "quant-migration"

// Lists a bundle holds at most; a shop larger than this moves in parts
const MAX = { categories: 5_000, brands: 5_000, products: 20_000, people: 200_000 } as const

const text = (max: number) => z.string().trim().min(1).max(max)
// A field a bundle may leave out: null either way
const optional = <T extends z.ZodType>(schema: T) =>
  schema.nullish().transform((value) => value ?? null)
const key = text(255)
const amount = z.string().regex(/^\d{1,10}(\.\d{1,2})?$/)
// What a variant sells for: never nothing
const price = amount.refine((value) => Number(value) > 0)
const date = z.iso.datetime({ offset: true }).transform((value) => new Date(value))
// A path on the old site, never another site: "/urun/tava"
const oldPath = z
  .string()
  .max(2048)
  .regex(/^\/(?!\/)\S*$/)
const image = z.url({ protocol: /^https?$/ }).max(2048)

const category = z.strictObject({
  source_key: key,
  path: z.array(text(255)).min(1).max(10),
  description: optional(z.string().max(20_000)),
  old_url: optional(oldPath),
})

const brand = z.strictObject({ source_key: key, name: text(255), old_url: optional(oldPath) })

const variant = z.strictObject({
  source_key: key,
  sku: optional(text(255)),
  barcode: optional(text(64)),
  price,
  compare_at_price: optional(amount),
  stock: optional(z.number().int().min(0).max(10_000_000)),
  options: z.record(text(255), text(255)).default({}),
  weight: optional(z.number().int().min(0).max(10_000_000)),
})

const product = z.strictObject({
  source_key: key,
  // The catalog stores handles in lower case: the migration finds a product by the same
  handle: text(255).transform((value) => value.toLowerCase()),
  title: text(255),
  description: optional(z.string().max(50_000)),
  status: z.enum(["published", "draft"]),
  categories: z
    .array(z.array(text(255)).min(1).max(10))
    .max(20)
    .default([]),
  brand: optional(text(255)),
  seo_title: optional(z.string().max(255)),
  seo_description: optional(z.string().max(1_000)),
  images: z.array(image).max(50).default([]),
  options: z
    .array(z.strictObject({ name: text(255), values: z.array(text(255)).min(1).max(100) }))
    .max(3)
    .default([]),
  variants: z.array(variant).min(1).max(100),
  dimensions: optional(
    z.strictObject({
      length: z.number().positive().max(10_000),
      width: z.number().positive().max(10_000),
      height: z.number().positive().max(10_000),
    })
  ),
  old_url: optional(oldPath),
})

const address = z.strictObject({
  first_name: optional(text(255)),
  last_name: optional(text(255)),
  company: optional(text(255)),
  address_1: optional(text(500)),
  address_2: optional(text(500)),
  city: optional(text(255)),
  province: optional(text(255)),
  postal_code: optional(text(20)),
  phone: optional(text(32)),
})

const customer = z.strictObject({
  source_key: key,
  email: text(320),
  first_name: optional(text(255)),
  last_name: optional(text(255)),
  phone: optional(text(32)),
  addresses: z.array(address).max(20).default([]),
  marketing: optional(z.strictObject({ email: optional(date), sms: optional(date) })),
  created_at: optional(date),
})

const order = z.strictObject({
  source_key: key,
  number: text(64),
  created_at: date,
  currency: z.string().regex(/^[a-z]{3}$/),
  total: amount,
  status: text(64),
  customer_email: optional(text(320)),
  lines: z
    .array(
      z.strictObject({
        title: text(500),
        sku: optional(text(255)),
        quantity: z.number().int().min(1).max(100_000),
        total: amount,
      })
    )
    .max(500),
})

const review = z.strictObject({
  source_key: key,
  product_source_key: key,
  author: optional(text(255)),
  customer_email: optional(text(320)),
  rating: z.number().int().min(1).max(5),
  title: optional(z.string().max(255)),
  body: z.string().max(10_000),
  published: z.boolean(),
  created_at: date,
})

const page = z.strictObject({ source_key: key, title: text(255), old_url: oldPath })

export const bundleSchema = z.strictObject({
  format: z.literal(BUNDLE_FORMAT),
  version: z.literal(1),
  // Which shop's data it is: two unrelated bundles keep their records apart
  source_id: z
    .string()
    .regex(/^[a-z0-9-]{1,40}$/)
    .optional(),
  categories: z.array(category).max(MAX.categories).default([]),
  brands: z.array(brand).max(MAX.brands).default([]),
  products: z.array(product).max(MAX.products).default([]),
  customers: z.array(customer).max(MAX.people).default([]),
  orders: z.array(order).max(MAX.people).default([]),
  reviews: z.array(review).max(MAX.people).default([]),
  pages: z.array(page).max(MAX.people).default([]),
})

export type Bundle = z.infer<typeof bundleSchema>

/** Where the first problem is, as a path a person can find in the file: "products.3.variants.0.price". */
const pathOf = (issue: z.core.$ZodIssue) => issue.path.map(String).join(".")

/**
 * The file as a migration source, or a validation error naming the first
 * place it breaks the format. Nothing is read from it until it all holds.
 */
export function bundleSource(buffer: Buffer): MigrationSource {
  let raw: unknown
  try {
    raw = JSON.parse(buffer.toString("utf8"))
  } catch {
    throw new ValidationError("migration.bundle_invalid")
  }
  const parsed = bundleSchema.safeParse(raw)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    throw new ValidationError(
      "migration.bundle_invalid",
      issue ? { field: pathOf(issue).slice(0, 200) } : {}
    )
  }
  const bundle = parsed.data
  // A list already in memory, as a source that reads page by page gives one
  const listOf =
    <T>(items: readonly T[]) =>
    (): AsyncIterable<T> => ({
      [Symbol.asyncIterator]: () => {
        const values = items.values()
        return { next: () => Promise.resolve(values.next()) }
      },
    })
  return {
    id: bundle.source_id ? `bundle:${bundle.source_id}` : "bundle",
    categories: listOf(bundle.categories),
    brands: listOf(bundle.brands),
    products: listOf(bundle.products),
    customers: listOf(bundle.customers),
    orders: listOf(bundle.orders),
    reviews: listOf(bundle.reviews),
    pages: listOf(bundle.pages),
  }
}
