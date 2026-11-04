import { z } from "@medusajs/framework/zod"
import { postalCodePlate, normalizePlateCode } from "../../../lib/tr/postal-code"
import { normalizeName, trMatchKey, trNeighborhoodMatchKey } from "../../../lib/tr/text"

export const NEIGHBORHOOD_KINDS = ["neighborhood", "village"] as const
export type NeighborhoodKind = (typeof NEIGHBORHOOD_KINDS)[number]

/** How sure the source is of a postal code (TürkiyeAPI); a file's codes count as official. */
export const POSTAL_CODE_STATUSES = ["official", "derived", "estimated"] as const
export type PostalCodeStatus = (typeof POSTAL_CODE_STATUSES)[number]

// A CSV's empty cell is a value left out
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === "" ? undefined : value), schema.optional())

/**
 * Normalized source-independent import row (adr/0008). Each data source gets
 * a small adapter that produces these fields. A source's own ids
 * (`turkiyeapi:district:1103`) let a renamed or moved place be updated
 * instead of replaced; the kind and the postal code's status are TürkiyeAPI's.
 */
export const trAddressRowSchema = z.object({
  province_code: z.union([z.string(), z.number()]),
  province_name: z.string(),
  district_name: z.string(),
  neighborhood_name: z.string().optional(),
  postal_code: z.string().optional(),
  district_external_id: optional(z.string().trim().min(1).max(100)),
  neighborhood_external_id: optional(z.string().trim().min(1).max(100)),
  neighborhood_kind: optional(z.enum(NEIGHBORHOOD_KINDS)),
  postal_code_status: optional(z.enum(POSTAL_CODE_STATUSES)),
})

/** A row as a source adapter writes it (the schema also takes a CSV's empty cells). */
export interface TrAddressRowInput {
  province_code: string | number
  province_name: string
  district_name: string
  neighborhood_name?: string
  postal_code?: string
  district_external_id?: string
  neighborhood_external_id?: string
  neighborhood_kind?: NeighborhoodKind
  postal_code_status?: PostalCodeStatus
}

export interface ParsedNeighborhood {
  name: string
  key: string
  postalCode: string
  externalId?: string
  kind?: NeighborhoodKind
  postalCodeStatus?: PostalCodeStatus
}

export interface TrAddressRow {
  provinceCode: string
  provinceName: string
  districtName: string
  districtKey: string
  districtExternalId?: string
  neighborhood?: ParsedNeighborhood
}

export interface RejectedRow {
  /** 1-based position in the input. */
  row: number
  reason: string
}

type ParseResult = { ok: true; row: TrAddressRow } | { ok: false; reason: string }

/** Validates one raw row; reasons are stable codes, never row contents. */
export function parseTrAddressRow(raw: unknown): ParseResult {
  const parsed = trAddressRowSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, reason: "invalid_shape" }
  }
  const input = parsed.data
  const provinceCode = normalizePlateCode(input.province_code)
  const provinceName = normalizeName(input.province_name)
  const districtName = normalizeName(input.district_name)
  if (!provinceCode) {
    return { ok: false, reason: "invalid_province_code" }
  }
  if (!provinceName || !districtName) {
    return { ok: false, reason: "missing_name" }
  }

  const row: TrAddressRow = {
    provinceCode,
    provinceName,
    districtName,
    districtKey: trMatchKey(districtName),
    ...(input.district_external_id ? { districtExternalId: input.district_external_id } : {}),
  }
  const neighborhoodName = normalizeName(input.neighborhood_name ?? "")
  if (!neighborhoodName) {
    return { ok: true, row }
  }

  const postalCode = (input.postal_code ?? "").trim()
  if (postalCodePlate(postalCode) !== provinceCode) {
    return { ok: false, reason: "postal_code_mismatch" }
  }
  row.neighborhood = {
    name: neighborhoodName,
    key: trNeighborhoodMatchKey(neighborhoodName),
    postalCode,
    ...(input.neighborhood_external_id ? { externalId: input.neighborhood_external_id } : {}),
    ...(input.neighborhood_kind ? { kind: input.neighborhood_kind } : {}),
    ...(input.postal_code_status ? { postalCodeStatus: input.postal_code_status } : {}),
  }
  return { ok: true, row }
}
