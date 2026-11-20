import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { containsPattern } from "../../../lib/security"
import { BRANDS_MODULE } from "../../../modules/brands"
import type BrandsModuleService from "../../../modules/brands/service"
import { storeBrandSummary } from "./read"
import type { StoreGetBrandsType } from "./validators"

/**
 * `GET /store/brands`: the shop's active brands by name (F3.11), for a
 * brands page or filter; without their text (the brand's page reads it).
 */
export async function GET(
  req: MedusaRequest<unknown, StoreGetBrandsType>,
  res: MedusaResponse
): Promise<void> {
  const { q, offset, limit } = req.validatedQuery
  const [brands, count] = await req.scope
    .resolve<BrandsModuleService>(BRANDS_MODULE)
    .listAndCountBrands(
      { is_active: true, ...(q ? { name: { $ilike: containsPattern(q) } } : {}) },
      { skip: offset, take: limit, order: { name: "ASC" } }
    )
  res.json({ brands: brands.map(storeBrandSummary), count, offset, limit })
}
