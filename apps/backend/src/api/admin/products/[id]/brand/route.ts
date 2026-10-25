import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { setProductBrandWorkflow } from "../../../../../workflows/brands/workflows"
import type { AdminPostProductBrandType } from "../../../brands/validators"

/** Sets the product's brand (F3.11), or takes it off with null. */
export async function POST(
  req: MedusaRequest<AdminPostProductBrandType>,
  res: MedusaResponse
): Promise<void> {
  const productId = req.params["id"] ?? ""
  await setProductBrandWorkflow(req.scope).run({
    input: { product_id: productId, brand_id: req.validatedBody.brand_id },
  })
  const { data } = await req.scope.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product",
    fields: ["id", "brand.id", "brand.name", "brand.handle"],
    filters: { id: productId },
  })
  const product = data[0] as { brand?: { id: string; name: string; handle: string } | null }
  res.json({ product_id: productId, brand: product.brand ?? null })
}
