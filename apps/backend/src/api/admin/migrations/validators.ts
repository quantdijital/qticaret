import { z } from "@medusajs/framework/zod"
import { CATEGORY_BASE, REFRESH_KINDS } from "../../../workflows/async-job/types/migration-run"
import { RUN_KINDS } from "../../../workflows/migration/kinds"
import { ANY_SOURCE_REFRESH } from "../../../workflows/migration/refresh"
import { URL_FILTERS } from "../../../workflows/migration/urls-read"

/** adr/0042 Ek 2026-11-27: what a run moves; none named, everything. */
const runKinds = z.array(z.enum(RUN_KINDS)).max(RUN_KINDS.length)
// In a query: `kinds=product,image`
const runKindsQuery = z.preprocess(
  (value) => (typeof value === "string" ? value.split(",").filter(Boolean) : value),
  runKinds
)

/**
 * `?mode=check` (the default) reports what the migration would do; `apply`
 * does it. `weight` (g), `length`, `width`, `height` (cm), all four or none:
 * an optional parcel written into the products without their own
 * measurements; without it they ship as the shop's default parcel (adr/0054).
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

/**
 * `POST /admin/migrations`: the file is a migration bundle (the default)
 * or a WordPress export (`source=wordpress`), whose product categories'
 * address base (`category_base=/urun-kategori/`) the owner may name, and
 * which may refresh only what a run moved before (`refresh=descriptions`,
 * adr/0055; `refresh=post_images`, adr/0042 Ek 2026-11-27).
 */
export const AdminPostMigrationFileQuery = AdminPostMigrationQuery.extend({
  source: z.enum(["bundle", "wordpress"]).default("bundle"),
  category_base: z.string().trim().max(64).regex(CATEGORY_BASE).optional(),
  refresh: z.enum(REFRESH_KINDS).optional(),
  kinds: runKindsQuery.optional(),
}).strict()
export type AdminPostMigrationFileQueryType = z.infer<typeof AdminPostMigrationFileQuery>

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
    kinds: runKinds.optional(),
    // adr/0042 Ek 2026-11-27: a store's or a feed's one completion, its products' missing pictures
    refresh: z.enum(ANY_SOURCE_REFRESH).optional(),
  })
  .strict()
export type AdminPostShopifyMigrationType = z.infer<typeof AdminPostShopifyMigration>

export const AdminGetMigrations = z
  .object({
    offset: z.coerce.number().int().min(0).max(10_000).default(0),
    // The run a job is moving: its live step (adr/0042 Ek 2026-11-27)
    job_id: z.string().min(1).max(64).optional(),
  })
  .strict()
export type AdminGetMigrationsType = z.infer<typeof AdminGetMigrations>

/** `GET /admin/migrations/urls`: the old site's addresses, the most clicked first. */
export const AdminGetMigrationUrls = z
  .object({
    filter: z.enum(URL_FILTERS).default("all"),
    offset: z.coerce.number().int().min(0).max(1_000_000).default(0),
  })
  .strict()
export type AdminGetMigrationUrlsType = z.infer<typeof AdminGetMigrationUrls>

/** `POST /admin/migrations/urls/:id/decision`: a 301 to a page here, gone, or the record's own. */
export const AdminPostMigrationUrlDecision = z
  .object({
    decision: z.enum(["auto", "redirect", "gone"]),
    target: z.string().trim().min(1).max(2048).optional(),
  })
  .strict()
export type AdminPostMigrationUrlDecisionType = z.infer<typeof AdminPostMigrationUrlDecision>

/** `POST /admin/migrations/urls/sitemap`: the old site's sitemap (or its index). */
export const AdminPostMigrationSitemap = z
  .object({ url: z.url({ protocol: /^https?$/ }).max(2048) })
  .strict()
export type AdminPostMigrationSitemapType = z.infer<typeof AdminPostMigrationSitemap>

/** `POST /admin/migrations/feed`: the old site's product feed (Google Merchant XML), checked or applied. */
export const AdminPostFeedMigration = AdminPostShopifyMigration.extend({
  url: z.url({ protocol: /^https?$/ }).max(2048),
}).strict()
export type AdminPostFeedMigrationType = z.infer<typeof AdminPostFeedMigration>
