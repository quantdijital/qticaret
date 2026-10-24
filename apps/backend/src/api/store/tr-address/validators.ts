import { z } from "@medusajs/framework/zod"
import { normalizePlateCode } from "../../../lib/tr/postal-code"

// docs/04: list endpoints page at most 100 records; clients page through larger districts
export const TR_ADDRESS_MAX_LIMIT = 100

const pagination = {
  limit: z.coerce.number().int().min(1).max(TR_ADDRESS_MAX_LIMIT).default(100),
  offset: z.coerce.number().int().min(0).default(0),
}

export const StoreGetTrProvinces = z.object(pagination)
export type StoreGetTrProvincesType = z.infer<typeof StoreGetTrProvinces>

export const StoreGetTrDistricts = z.object({
  ...pagination,
  /** Plate code, "6" or "06". */
  province: z.string().transform((value, ctx) => {
    const code = normalizePlateCode(value)
    if (!code) {
      ctx.addIssue({ code: "custom", message: "tr_address.province_code_invalid" })
      return z.NEVER
    }
    return code
  }),
})
export type StoreGetTrDistrictsType = z.infer<typeof StoreGetTrDistricts>

export const StoreGetTrNeighborhoods = z.object({
  ...pagination,
  district: z.string().regex(/^trdst_[0-9A-Z]{26}$/, "tr_address.district_id_invalid"),
})
export type StoreGetTrNeighborhoodsType = z.infer<typeof StoreGetTrNeighborhoods>
