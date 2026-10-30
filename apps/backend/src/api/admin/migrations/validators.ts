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

export const AdminGetMigrations = z
  .object({ offset: z.coerce.number().int().min(0).max(10_000).default(0) })
  .strict()
export type AdminGetMigrationsType = z.infer<typeof AdminGetMigrations>
