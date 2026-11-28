import { z } from "zod"

/**
 * A sector pack's sample catalogue (owner, 2026-11-28): one set per pack,
 * not per look, since every look of the pack finds products by category
 * handle. Loaded on a shop that asks for it, every record marked as a
 * sample, and removed from the panel again. The package owns the frame:
 * handles, references, images and limits. What a product holds beyond it
 * (attribute values, a program's steps) the backend checks with the
 * schemas its panel's saves go through.
 */

export const SAMPLES_DIR = "samples"
export const SAMPLES_FILE = "samples.json"
export const SAMPLE_FORMAT = "quant-sample-catalog"
export const SAMPLE_IMAGES_DIR = "images"
export const SAMPLE_IMAGE_PATH = /^images\/[a-z0-9]+(?:-[a-z0-9]+)*\.(?:webp|jpg|png)$/

const KIB = 1024
const MIB = 1024 * KIB

export const SAMPLE_LIMITS = {
  products: 30,
  categories: 30,
  images: 60,
  imageBytes: 512 * KIB,
  imagesBytes: 12 * MIB,
  imagesPerProduct: 6,
  reviewsPerProduct: 8,
  departuresPerProduct: 20,
} as const

const HANDLE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const handle = z.string().max(100).regex(HANDLE)
const text = (max: number) => z.string().trim().min(1).max(max)
const price = z.number().int().min(1).max(100_000_000)

export const sampleCategorySchema = z.strictObject({
  handle,
  name: text(100),
  parent: handle.optional(),
  description: text(1000).optional(),
})

export const sampleReviewSchema = z.strictObject({
  rating: z.number().int().min(1).max(5),
  body: text(2000),
  author: text(80),
  /** Days before the load the review is dated: a sample never ages into the past. */
  days_ago: z.number().int().min(1).max(720),
})

export const sampleDepartureSchema = z.strictObject({
  /** Days after the load: departures are always in the future. */
  in_days: z.number().int().min(1).max(720),
  capacity: z.number().int().min(1).max(10_000),
})

export const sampleProgramStepSchema = z.strictObject({
  label: text(40).nullable(),
  title: text(200),
  text: text(2000).optional(),
  tags: z
    .array(z.string().regex(/^[a-z_]{1,40}$/))
    .max(10)
    .default([]),
})

/** A dated product's booking set-up (adr/0076): departures, child prices, its program (adr/0078). */
export const sampleBookingSchema = z.strictObject({
  sale_mode: z.enum(["online", "request", "both"]).default("online"),
  min_participants: z.number().int().min(1).max(1000).optional(),
  /** The option value of the child variant: counted one place, aged 2 to 11. */
  child_value: text(60).optional(),
  departures: z.array(sampleDepartureSchema).min(1).max(SAMPLE_LIMITS.departuresPerProduct),
  program: z
    .strictObject({
      unit: z.enum(["day", "step"]),
      steps: z.array(sampleProgramStepSchema).min(1).max(60),
    })
    .optional(),
})

export const sampleProductSchema = z.strictObject({
  handle,
  title: text(200),
  /** One line under the title (the short description). */
  summary: text(300).optional(),
  description: text(5000),
  /** Category handles, the first the primary one. */
  categories: z.array(handle).min(1).max(10),
  /** An attribute template of the pack, and the product's values for it. */
  template: handle.optional(),
  attributes: z.record(z.string(), z.unknown()).default({}),
  options: z
    .array(z.strictObject({ title: text(60), values: z.array(text(60)).min(1).max(20) }))
    .min(1)
    .max(3),
  variants: z
    .array(
      z.strictObject({
        options: z.record(z.string(), text(60)),
        price,
      })
    )
    .min(1)
    .max(20),
  images: z.array(z.string().regex(SAMPLE_IMAGE_PATH)).min(1).max(SAMPLE_LIMITS.imagesPerProduct),
  booking: sampleBookingSchema.optional(),
  reviews: z.array(sampleReviewSchema).max(SAMPLE_LIMITS.reviewsPerProduct).default([]),
})

export const sampleCatalogSchema = z.strictObject({
  format: z.literal(SAMPLE_FORMAT),
  /** Raised when the set changes; written into every record's mark. */
  version: z.number().int().min(1).max(10_000),
  /** Turkish, as the panel's card names it ("Örnek turlar"). */
  name: text(80),
  categories: z.array(sampleCategorySchema).max(SAMPLE_LIMITS.categories).default([]),
  products: z.array(sampleProductSchema).min(1).max(SAMPLE_LIMITS.products),
  /** Where each image comes from and under what licence (as a preset's credits). */
  credits: z
    .array(
      z.strictObject({
        file: z.string().regex(SAMPLE_IMAGE_PATH),
        source: text(300),
        license: text(300),
      })
    )
    .max(SAMPLE_LIMITS.images),
})

export type SampleCatalogData = z.infer<typeof sampleCatalogSchema>
export type SampleProduct = z.infer<typeof sampleProductSchema>
export type SampleCategory = z.infer<typeof sampleCategorySchema>
export type SampleBooking = z.infer<typeof sampleBookingSchema>

/** A pack's sample catalogue as read: its file and where its images are on disk. */
export interface SampleCatalog extends SampleCatalogData {
  /** The `samples` folder: an image `images/x.webp` is read from beside it. */
  dir: string
}
