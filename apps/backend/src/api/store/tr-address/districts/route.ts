import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { TR_ADDRESS_MODULE } from "../../../../modules/tr-address"
import type TrAddressModuleService from "../../../../modules/tr-address/service"
import { setReferenceDataCache } from "../cache"
import type { StoreGetTrDistrictsType } from "../validators"

export async function GET(
  req: MedusaRequest<unknown, StoreGetTrDistrictsType>,
  res: MedusaResponse
): Promise<void> {
  const { province, limit, offset } = req.validatedQuery as StoreGetTrDistrictsType
  const service = req.scope.resolve<TrAddressModuleService>(TR_ADDRESS_MODULE)

  const [match] = await service.listTrProvinces(
    { code: province, is_active: true },
    { select: ["id"], take: 1 }
  )
  const [districts, count] = match
    ? await service.listAndCountTrDistricts(
        { province_id: match.id, is_active: true },
        { select: ["id", "name"], order: { sort_key: "ASC" }, skip: offset, take: limit }
      )
    : [[], 0]

  setReferenceDataCache(res)
  res.json({ districts, count, offset, limit })
}
