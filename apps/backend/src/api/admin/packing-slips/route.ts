import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { readPackingSlips } from "./read"
import type { AdminGetPackingSlipsType } from "./validators"

/**
 * GET /admin/packing-slips?ids= : what the picked orders' packing slips and
 * pick list print (the order page's "Yazdır", the list's picked orders);
 * people only, a recorded read of their addresses (adr/0011).
 */
export async function GET(
  req: AuthenticatedMedusaRequest<unknown, AdminGetPackingSlipsType>,
  res: MedusaResponse
): Promise<void> {
  res.setHeader("Cache-Control", "no-store")
  res.json(await readPackingSlips(req.scope, req.validatedQuery.ids))
}
