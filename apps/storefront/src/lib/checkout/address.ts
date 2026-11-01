import "server-only"
import { cache } from "react"
import type { OptionView } from "@qticaret/ui"
import { storeGet } from "../store-api/server"

/**
 * Turkey's provinces, districts and neighbourhoods (F1, the backend's
 * `tr-address` data; answers cached there for an hour). The cart keeps
 * names (`province`, `city` = district, `address_2` = neighbourhood); the
 * form's selects keep the plate and the ids, to ask for the next list.
 */

export interface Province {
  id: string
  code: string
  name: string
}

export interface Named {
  id: string
  name: string
}

export interface Neighborhood extends Named {
  postal_code: string
}

export const provinces = cache(async (): Promise<Province[]> => {
  const { provinces: list } = await storeGet<{ provinces: Province[] }>(
    "/store/tr-address/provinces",
    { limit: 100 }
  )
  return list
})

const PLATE = /^(0?[1-9]|[1-7]\d|8[01])$/
const DISTRICT_ID = /^trdst_[0-9A-Za-z]{1,64}$/

export const districtsOf = cache(async (plate: string): Promise<Named[]> => {
  if (!PLATE.test(plate)) {
    return []
  }
  const { districts } = await storeGet<{ districts: Named[] }>("/store/tr-address/districts", {
    province: plate,
    limit: 100,
  })
  return districts
})

export const neighborhoodsOf = cache(async (districtId: string): Promise<Neighborhood[]> => {
  if (!DISTRICT_ID.test(districtId)) {
    return []
  }
  const found: Neighborhood[] = []
  // A district has a few hundred neighbourhoods at most; read them all
  for (let offset = 0; offset < 2000; offset += 100) {
    const { neighborhoods, count } = await storeGet<{
      neighborhoods: Neighborhood[]
      count: number
    }>("/store/tr-address/neighborhoods", { district: districtId, limit: 100, offset })
    found.push(...neighborhoods)
    if (found.length >= count || neighborhoods.length === 0) {
      break
    }
  }
  return found
})

const byName = (a: OptionView, b: OptionView) => a.label.localeCompare(b.label, "tr")

export const provinceOptions = async (): Promise<OptionView[]> =>
  (await provinces()).map((each) => ({ value: each.code, label: each.name }))

export const districtOptions = async (plate: string): Promise<OptionView[]> =>
  (await districtsOf(plate)).map((each) => ({ value: each.id, label: each.name })).sort(byName)

export const neighborhoodOptions = async (districtId: string): Promise<OptionView[]> =>
  (await neighborhoodsOf(districtId))
    .map((each) => ({ value: each.id, label: each.name }))
    .sort(byName)

/** Compares names as the backend does: case and Turkish letters aside. */
export function sameName(a: string, b: string): boolean {
  const plain = (value: string) =>
    value
      .toLocaleLowerCase("tr")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/ı/g, "i")
      .replace(/\s+(mah\.?|mahallesi)$/u, "")
      .trim()
  return plain(a) === plain(b)
}

/** The saved address's names back to the selects' plate and ids, as far as they match. */
export async function selectsOf(address: {
  province: string | null
  city: string | null
  address_2: string | null
}): Promise<{ province: string; district: string; neighborhood: string }> {
  const province = address.province
    ? (await provinces()).find((each) => sameName(each.name, address.province ?? ""))
    : undefined
  if (!province) {
    return { province: "", district: "", neighborhood: "" }
  }
  const district = address.city
    ? (await districtsOf(province.code)).find((each) => sameName(each.name, address.city ?? ""))
    : undefined
  if (!district) {
    return { province: province.code, district: "", neighborhood: "" }
  }
  const neighborhood = address.address_2
    ? (await neighborhoodsOf(district.id)).find((each) =>
        sameName(each.name, address.address_2 ?? "")
      )
    : undefined
  return { province: province.code, district: district.id, neighborhood: neighborhood?.id ?? "" }
}
