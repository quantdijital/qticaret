import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { storeLandingProducts } from "../../read"
import type { StoreGetLandingProductsType } from "../../validators"

/** `GET /store/landings/:id/products`: product ids; the storefront reads them from the Store product API. */
export async function GET(
  req: MedusaRequest<unknown, StoreGetLandingProductsType>,
  res: MedusaResponse
): Promise<void> {
  res.json(await storeLandingProducts(req.scope, req.params["id"] ?? "", req.validatedQuery))
}
