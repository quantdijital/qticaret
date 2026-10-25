import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { containsPattern } from "../../../../lib/security"
import { BRANDS_MODULE } from "../../../../modules/brands"
import type BrandsModuleService from "../../../../modules/brands/service"
import type { BrandRecord } from "../../../../modules/brands/service"
import type { AuditedResource, GraphQuery, Resolver, Snapshot } from "../types"
import { ID } from "../types"

/**
 * Brands and a product's brand (F3.11, adr/0011): name, handle, text,
 * logo and status before and after. A new brand is found by the name in
 * its body.
 */

const brands = (scope: Resolver) => scope.resolve(BRANDS_MODULE) as BrandsModuleService

const brandSnapshot = (brand: BrandRecord | undefined): Snapshot =>
  brand
    ? {
        name: brand.name,
        handle: brand.handle,
        description: brand.description,
        logo_file_id: brand.logo_file_id,
        is_active: brand.is_active,
      }
    : {}

async function byId(scope: Resolver, id: string): Promise<Snapshot> {
  const [brand] = await brands(scope).listBrands({ id }, { take: 1 })
  return brandSnapshot(brand)
}

async function byName(scope: Resolver, body: unknown): Promise<Snapshot> {
  const { name } = (body ?? {}) as { name?: unknown }
  if (typeof name !== "string" || name.trim() === "") {
    return {}
  }
  const exact = containsPattern(name.trim().replace(/\s+/g, " ")).slice(1, -1)
  const [brand] = await brands(scope).listBrands({ name: { $ilike: exact } }, { take: 1 })
  return brandSnapshot(brand)
}

async function productBrand(scope: Resolver, productId: string): Promise<Snapshot> {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY) as GraphQuery
  const { data } = await query.graph({
    entity: "product",
    fields: ["brand.id", "brand.name"],
    filters: { id: productId },
  })
  const brand = (data[0] as { brand?: { id: string; name: string } | null } | undefined)?.brand
  return { brand_id: brand?.id ?? null, brand_name: brand?.name ?? null }
}

export const BRAND_RESOURCES: readonly AuditedResource[] = [
  {
    method: "POST",
    route: "POST /admin/brands",
    pattern: /^\/admin\/brands$/i,
    resourceType: "brand",
    resourceId: () => null,
    snapshot: ({ scope, body }) => byName(scope, body),
  },
  ...(["POST", "DELETE"] as const).map((method) => ({
    method,
    route: `${method} /admin/brands/:id`,
    pattern: new RegExp(`^/admin/brands/(?<id>${ID})$`, "i"),
    resourceType: "brand",
    resourceId: (params: Record<string, string>) => params["id"] ?? null,
    snapshot: ({ scope, params }: { scope: Resolver; params: Record<string, string> }) =>
      byId(scope, params["id"] ?? ""),
  })),
  {
    method: "POST",
    route: "POST /admin/products/:id/brand",
    pattern: new RegExp(`^/admin/products/(?<id>${ID})/brand$`, "i"),
    resourceType: "product",
    resourceId: (params) => params["id"] ?? null,
    snapshot: ({ scope, params }) => productBrand(scope, params["id"] ?? ""),
  },
]
