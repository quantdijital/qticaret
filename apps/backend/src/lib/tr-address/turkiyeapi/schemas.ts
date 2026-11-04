import { z } from "@medusajs/framework/zod"

/**
 * What we read of TürkiyeAPI v2 (docs/entegrasyonlar/turkiye-api.md),
 * checked from its OpenAPI document (2026-11-04, API 2.0.3, dataset 2025).
 * Only the fields the import uses; unknown fields are dropped. Postal code
 * statuses and municipality types are read as text, so a value added later
 * does not fail the whole sync (map.ts decides what it means).
 */

const id = z.number().int().positive()
const name = z.string().trim().min(1).max(200)
const shortText = z.string().max(40)

export const turkiyeApiMeta = z.object({
  datasetVersion: z.string().trim().min(1).max(40),
  lastUpdated: z.string().trim().min(1).max(40),
  counts: z.object({
    provinces: z.number().int().nonnegative(),
    districts: z.number().int().nonnegative(),
    municipalities: z.number().int().nonnegative(),
    neighborhoods: z.number().int().nonnegative(),
    villages: z.number().int().nonnegative(),
  }),
})
export type TurkiyeApiMeta = z.infer<typeof turkiyeApiMeta>

export const metaAnswer = z.object({ data: turkiyeApiMeta })

export const province = z.object({ id, name })
export const district = z.object({ id, name, provinceId: id })
export const municipality = z.object({ id, name, type: shortText, districtId: id })
export const neighborhood = z.object({
  id,
  name,
  districtId: id,
  municipalityId: id,
  postalCode: shortText,
  postalCodeStatus: shortText,
})
export const village = z.object({
  id,
  name,
  districtId: id,
  postalCode: shortText,
  postalCodeStatus: shortText,
})

export type Province = z.infer<typeof province>
export type District = z.infer<typeof district>
export type Municipality = z.infer<typeof municipality>
export type Neighborhood = z.infer<typeof neighborhood>
export type Village = z.infer<typeof village>

/** The five collections, each a dataset file (`/datasets/<name>.json`) and a paged list. */
export const COLLECTIONS = {
  provinces: province,
  districts: district,
  municipalities: municipality,
  neighborhoods: neighborhood,
  villages: village,
} as const

export type CollectionName = keyof typeof COLLECTIONS
export type CollectionRecord<N extends CollectionName> = z.infer<(typeof COLLECTIONS)[N]>

/** A page of a list endpoint: `{ data, meta: { total, … } }`. */
export const pageAnswer = <T extends z.ZodType>(item: T) =>
  z.object({
    data: z.array(item),
    meta: z.object({
      total: z.number().int().nonnegative(),
      datasetVersion: z.string().max(40).optional(),
      lastUpdated: z.string().max(40).optional(),
    }),
  })
