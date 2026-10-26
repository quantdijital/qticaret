import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { setReferenceDataCache } from "../cache"
import { readDistricts } from "../../../tr-address/read"
import type { GetTrDistrictsType } from "../../../tr-address/validators"

export async function GET(
  req: MedusaRequest<unknown, GetTrDistrictsType>,
  res: MedusaResponse
): Promise<void> {
  const body = await readDistricts(req.scope, req.validatedQuery)
  setReferenceDataCache(res)
  res.json(body)
}
