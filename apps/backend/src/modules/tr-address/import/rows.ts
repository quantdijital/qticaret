import { z } from "@medusajs/framework/zod"
import { postalCodePlate, normalizePlateCode } from "../../../lib/tr/postal-code"
import { normalizeName, trMatchKey, trNeighborhoodMatchKey } from "../../../lib/tr/text"

/**
 * Normalized source-independent import row (adr/0008). Each data source gets
 * a small adapter that produces these fields.
 */
export const trAddressRowSchema = z.object({
  province_code: z.union([z.string(), z.number()]),
  province_name: z.string(),
  district_name: z.string(),
  neighborhood_name: z.string().optional(),
  postal_code: z.string().optional(),
})

export type TrAddressRowInput = z.input<typeof trAddressRowSchema>

export interface TrAddressRow {
  provinceCode: string
  provinceName: string
  districtName: string
  districtKey: string
  neighborhood?: { name: string; key: string; postalCode: string }
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
  }
  return { ok: true, row }
}
