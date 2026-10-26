import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { storeContentList } from "./read"
import type { StoreGetContentType } from "./validators"

export async function GET(
  req: MedusaRequest<unknown, StoreGetContentType>,
  res: MedusaResponse
): Promise<void> {
  res.json(await storeContentList(req.scope, req.validatedQuery))
}
