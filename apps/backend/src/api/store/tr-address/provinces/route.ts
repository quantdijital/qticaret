import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { TR_ADDRESS_MODULE } from "../../../../modules/tr-address"
import type TrAddressModuleService from "../../../../modules/tr-address/service"
import { setReferenceDataCache } from "../cache"
import type { StoreGetTrProvincesType } from "../validators"

export async function GET(
  req: MedusaRequest<unknown, StoreGetTrProvincesType>,
  res: MedusaResponse
): Promise<void> {
  const { limit, offset } = req.validatedQuery as StoreGetTrProvincesType
  const service = req.scope.resolve<TrAddressModuleService>(TR_ADDRESS_MODULE)

  const [provinces, count] = await service.listAndCountTrProvinces(
    { is_active: true },
    { select: ["id", "code", "name"], order: { sort_key: "ASC" }, skip: offset, take: limit }
  )

  setReferenceDataCache(res)
  res.json({ provinces, count, offset, limit })
}
