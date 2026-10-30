import { z } from "@medusajs/framework/zod"

/**
 * `?mode=check` (the default) reports what the migration would do; `apply`
 * does it. `weight` (g), `length`, `width`, `height` (cm), all four or none:
 * the parcel of a product without its own measurements.
 */
export const AdminPostMigrationQuery = z
  .object({
    mode: z.enum(["check", "apply"]).default("check"),
    weight: z.coerce.number().positive().max(1_000_000).optional(),
    length: z.coerce.number().positive().max(10_000).optional(),
    width: z.coerce.number().positive().max(10_000).optional(),
    height: z.coerce.number().positive().max(10_000).optional(),
  })
  .strict()
export type AdminPostMigrationQueryType = z.infer<typeof AdminPostMigrationQuery>

/** `POST /admin/migrations/shopify`: the connected store, checked or applied. */
export const AdminPostShopifyMigration = z
  .object({
    mode: z.enum(["check", "apply"]).default("check"),
    // The parcel of a product without its own measurements: grams and cm
    defaults: z
      .object({
        weight: z.number().positive().max(1_000_000),
        length: z.number().positive().max(10_000),
        width: z.number().positive().max(10_000),
        height: z.number().positive().max(10_000),
      })
      .strict()
      .nullable()
      .default(null),
  })
  .strict()
export type AdminPostShopifyMigrationType = z.infer<typeof AdminPostShopifyMigration>

export const AdminGetMigrations = z
  .object({ offset: z.coerce.number().int().min(0).max(10_000).default(0) })
  .strict()
export type AdminGetMigrationsType = z.infer<typeof AdminGetMigrations>
