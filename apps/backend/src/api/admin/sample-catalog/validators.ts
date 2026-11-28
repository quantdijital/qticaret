import { z } from "@medusajs/framework/zod"
import { PACK_CODE } from "@qticaret/sector-packs"
import { SAMPLE_PARTS } from "../../../lib/sample-catalog/plan"

/**
 * `GET /admin/sample-catalog`: `?job=1` answers the newest load job alone
 * (the panel polls it while a load runs; the whole catalogue is read once
 * the job ends).
 */
export const AdminGetSampleCatalog = z.object({ job: z.enum(["1"]).optional() }).strict()
export type AdminGetSampleCatalogType = z.output<typeof AdminGetSampleCatalog>

/** A pack's sample catalogue loaded (owner, 2026-11-28): the pack's code only. */
export const AdminPostSampleCatalogLoad = z.object({ pack: z.string().regex(PACK_CODE) }).strict()
export type AdminPostSampleCatalogLoadType = z.output<typeof AdminPostSampleCatalogLoad>

const id = z.string().min(1).max(64)

/**
 * "Örnek içeriği kaldır": the parts chosen (at least one), the sample
 * products kept by name, and `dry_run` to see the plan without writing.
 */
export const AdminPostSampleCatalogRemove = z
  .object({
    parts: z
      .array(z.enum(SAMPLE_PARTS))
      .min(1)
      .max(SAMPLE_PARTS.length)
      .transform((parts) => [...new Set(parts)]),
    keep_product_ids: z.array(id).max(500).default([]),
    dry_run: z.boolean().default(false),
  })
  .strict()
export type AdminPostSampleCatalogRemoveType = z.output<typeof AdminPostSampleCatalogRemove>
