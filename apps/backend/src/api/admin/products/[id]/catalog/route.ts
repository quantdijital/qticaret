import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { setProductCatalogWorkflow } from "../../../../../workflows/catalog/set-product-catalog"
import { readProductCatalog } from "./read"
import type { AdminPostProductCatalogType } from "./validators"

const idOf = (req: AuthenticatedMedusaRequest): string => req.params["id"] ?? ""

/** The product's catalog fields (F3.1). */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  res.json(await readProductCatalog(req.scope, idOf(req)))
}

/** Saves the fields sent; fields left out keep their values, null clears one. */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostProductCatalogType>,
  res: MedusaResponse
): Promise<void> {
  await setProductCatalogWorkflow(req.scope).run({
    input: { product_id: idOf(req), ...req.validatedBody },
  })
  res.json(await readProductCatalog(req.scope, idOf(req)))
}
