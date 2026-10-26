import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { setReferenceDataCache } from "../cache"
import { readProvinces } from "../../../tr-address/read"
import type { GetTrProvincesType } from "../../../tr-address/validators"

export async function GET(
  req: MedusaRequest<unknown, GetTrProvincesType>,
  res: MedusaResponse
): Promise<void> {
  const body = await readProvinces(req.scope, req.validatedQuery)
  setReferenceDataCache(res)
  res.json(body)
}
