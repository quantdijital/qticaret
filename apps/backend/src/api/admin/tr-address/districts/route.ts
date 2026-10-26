import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { readDistricts } from "../../../tr-address/read"
import type { GetTrDistrictsType } from "../../../tr-address/validators"

/** `GET /admin/tr-address/districts?province=34`: the panel's address forms. */
export async function GET(
  req: MedusaRequest<unknown, GetTrDistrictsType>,
  res: MedusaResponse
): Promise<void> {
  const body = await readDistricts(req.scope, req.validatedQuery)
  // Reference data, but an admin answer: kept by the browser only, once read
  res.setHeader("Cache-Control", "private, max-age=3600")
  res.json(body)
}
