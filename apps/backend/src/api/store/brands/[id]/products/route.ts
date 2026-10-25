import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import ProductBrandLink from "../../../../../links/product-brand"
import { activeBrand } from "../../read"
import type { StoreGetBrandProductsType } from "../../validators"

/**
 * `GET /store/brands/:id/products`: the brand's published products, newest
 * first, as ids. The storefront loads them with `/store/products?id[]=`,
 * which prices them for its region and keeps to its sales channel.
 */
export async function GET(
  req: MedusaRequest<unknown, StoreGetBrandProductsType>,
  res: MedusaResponse
): Promise<void> {
  const brand = await activeBrand(req.scope, req.params["id"] ?? "")
  const { offset, limit } = req.validatedQuery
  const { data } = await req.scope.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: ProductBrandLink.entryPoint,
    fields: ["product_id"],
    filters: { brand_id: brand.id },
  })
  const linked = (data as { product_id: string }[]).map((row) => row.product_id)
  const [products, count] = linked.length
    ? await req.scope
        .resolve(Modules.PRODUCT)
        .listAndCountProducts(
          { id: linked, status: "published" },
          { select: ["id"], skip: offset, take: limit, order: { created_at: "DESC" } }
        )
    : [[], 0]
  res.json({ product_ids: products.map((product) => product.id), count, offset, limit })
}
