import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { TR_ADDRESS_MODULE } from "../../../../modules/tr-address"
import type TrAddressModuleService from "../../../../modules/tr-address/service"
import { setReferenceDataCache } from "../cache"
import type { StoreGetTrNeighborhoodsType } from "../validators"

export async function GET(
  req: MedusaRequest<unknown, StoreGetTrNeighborhoodsType>,
  res: MedusaResponse
): Promise<void> {
  const { district, limit, offset } = req.validatedQuery as StoreGetTrNeighborhoodsType
  const service = req.scope.resolve<TrAddressModuleService>(TR_ADDRESS_MODULE)

  const [neighborhoods, count] = await service.listAndCountTrNeighborhoods(
    { district_id: district, is_active: true },
    { select: ["id", "name", "postal_code"], order: { sort_key: "ASC" }, skip: offset, take: limit }
  )

  setReferenceDataCache(res)
  res.json({ neighborhoods, count, offset, limit })
}
