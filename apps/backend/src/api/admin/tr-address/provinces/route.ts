import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { readProvinces } from "../../../tr-address/read"
import type { GetTrProvincesType } from "../../../tr-address/validators"

/** `GET /admin/tr-address/provinces`: the panel's address forms (F3.7 warehouses). */
export async function GET(
  req: MedusaRequest<unknown, GetTrProvincesType>,
  res: MedusaResponse
): Promise<void> {
  const body = await readProvinces(req.scope, req.validatedQuery)
  // Reference data, but an admin answer: kept by the browser only, once read
  res.setHeader("Cache-Control", "private, max-age=3600")
  res.json(body)
}
