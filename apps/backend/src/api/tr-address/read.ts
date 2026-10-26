import type { MedusaContainer } from "@medusajs/framework/types"
import { TR_ADDRESS_MODULE } from "../../modules/tr-address"
import type TrAddressModuleService from "../../modules/tr-address/service"
import type { GetTrDistrictsType, GetTrProvincesType } from "./validators"

/** Active provinces (il) in their reference order; read by the Store API and the panel. */
export async function readProvinces(scope: MedusaContainer, query: GetTrProvincesType) {
  const service = scope.resolve<TrAddressModuleService>(TR_ADDRESS_MODULE)
  const [provinces, count] = await service.listAndCountTrProvinces(
    { is_active: true },
    {
      select: ["id", "code", "name"],
      order: { sort_key: "ASC" },
      skip: query.offset,
      take: query.limit,
    }
  )
  return { provinces, count, offset: query.offset, limit: query.limit }
}

/** A province's active districts (ilçe) by its plate code; none for an unknown code. */
export async function readDistricts(scope: MedusaContainer, query: GetTrDistrictsType) {
  const service = scope.resolve<TrAddressModuleService>(TR_ADDRESS_MODULE)
  const [match] = await service.listTrProvinces(
    { code: query.province, is_active: true },
    { select: ["id"], take: 1 }
  )
  const [districts, count] = match
    ? await service.listAndCountTrDistricts(
        { province_id: match.id, is_active: true },
        {
          select: ["id", "name"],
          order: { sort_key: "ASC" },
          skip: query.offset,
          take: query.limit,
        }
      )
    : [[], 0]
  return { districts, count, offset: query.offset, limit: query.limit }
}
