import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import ProductBrandLink from "../../../links/product-brand"
import { containsPattern } from "../../../lib/security"
import { BRANDS_MODULE } from "../../../modules/brands"
import type BrandsModuleService from "../../../modules/brands/service"
import type { BrandRecord } from "../../../modules/brands/service"
import type { AdminGetBrandsType } from "./validators"

export const presentBrand = (brand: BrandRecord, products = 0) => ({
  id: brand.id,
  name: brand.name,
  handle: brand.handle,
  description: brand.description,
  logo_file_id: brand.logo_file_id,
  logo_url: brand.logo_url,
  logo_width: brand.logo_width,
  logo_height: brand.logo_height,
  is_active: brand.is_active,
  product_count: products,
  created_at: brand.created_at,
  updated_at: brand.updated_at,
})

/** How many products each brand has, from the link table, in one query. */
export async function productCounts(
  container: MedusaContainer,
  brandIds: string[]
): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  if (brandIds.length === 0) {
    return counts
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: ProductBrandLink.entryPoint,
    fields: ["brand_id"],
    filters: { brand_id: brandIds },
  })
  for (const { brand_id } of data as { brand_id: string }[]) {
    counts.set(brand_id, (counts.get(brand_id) ?? 0) + 1)
  }
  return counts
}

/** A page of brands by name, with their product counts. */
export async function readBrands(container: MedusaContainer, query: AdminGetBrandsType) {
  const service = container.resolve<BrandsModuleService>(BRANDS_MODULE)
  const [brands, count] = await service.listAndCountBrands(
    {
      ...(query.q ? { name: { $ilike: containsPattern(query.q) } } : {}),
      ...(query.active ? { is_active: query.active === "true" } : {}),
    },
    { skip: query.offset, take: query.limit, order: { name: "ASC" } }
  )
  const counts = await productCounts(
    container,
    brands.map((brand) => brand.id)
  )
  return {
    brands: brands.map((brand) => presentBrand(brand, counts.get(brand.id) ?? 0)),
    count,
    offset: query.offset,
    limit: query.limit,
  }
}

export async function readBrand(container: MedusaContainer, id: string) {
  const service = container.resolve<BrandsModuleService>(BRANDS_MODULE)
  const brand = await service.retrieveBrand(id)
  const counts = await productCounts(container, [id])
  return presentBrand(brand, counts.get(id) ?? 0)
}
