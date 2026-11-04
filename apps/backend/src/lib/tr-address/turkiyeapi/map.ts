import type { TrAddressRowInput } from "../../../modules/tr-address/import/rows"
import type { District, Municipality, Neighborhood, Province, Village } from "./schemas"

/**
 * TürkiyeAPI records as the import's normalized rows (adr/0008 Ek
 * 2026-11-04). The address levels are il, ilçe and mahalle/köy:
 *
 * - a district row per district, so one without settlements is kept;
 * - a neighbourhood keeps its name; one of a town municipality (belde) is
 *   "Fatih (Kırka)": a district holds several towns, and their
 *   neighbourhoods share names ("Fatih" six times in one district) and not
 *   postal codes. Municipalities are no address level of their own;
 * - a village (köy) belongs to its district directly, as a settlement of
 *   kind `village` named "Alcalı Köyü", so a village and a neighbourhood
 *   of the same name stay apart.
 *
 * Every record keeps its TürkiyeAPI id (`external_id`), so a renamed or
 * moved place is updated, not replaced. Records are taken in id order, so
 * the same dataset always makes the same rows.
 */

export interface TurkiyeApiDataset {
  provinces: Province[]
  districts: District[]
  municipalities: Municipality[]
  neighborhoods: Neighborhood[]
  villages: Village[]
}

export interface MappedRows {
  rows: TrAddressRowInput[]
  /** Records whose district or province is not in the dataset; left out. */
  orphans: number
}

const VILLAGE_SUFFIX = " Köyü"

export const externalId = (kind: "district" | "neighborhood" | "village", id: number) =>
  `turkiyeapi:${kind}:${String(id)}`

const byId = <T extends { id: number }>(records: readonly T[]) =>
  [...records].sort((a, b) => a.id - b.id)

/** `official` and `derived` (from a known PTT code) as given; anything else is an estimate. */
function postalStatus(value: string): "official" | "derived" | "estimated" {
  return value === "official" || value === "derived" ? value : "estimated"
}

export const villageName = (name: string): string =>
  name.trim().endsWith(VILLAGE_SUFFIX.trim()) ? name.trim() : `${name.trim()}${VILLAGE_SUFFIX}`

export const townNeighborhoodName = (name: string, town: string): string =>
  `${name.trim()} (${town.trim()})`

export function toImportRows(dataset: TurkiyeApiDataset): MappedRows {
  const provinces = new Map(dataset.provinces.map((province) => [province.id, province]))
  const towns = new Map(
    dataset.municipalities
      .filter((municipality) => municipality.type === "town")
      .map((municipality) => [municipality.id, municipality.name])
  )
  const districts = new Map<number, TrAddressRowInput>()
  const rows: TrAddressRowInput[] = []
  let orphans = 0

  for (const district of byId(dataset.districts)) {
    const province = provinces.get(district.provinceId)
    if (!province) {
      orphans++
      continue
    }
    const row: TrAddressRowInput = {
      province_code: province.id,
      province_name: province.name,
      district_name: district.name,
      district_external_id: externalId("district", district.id),
    }
    districts.set(district.id, row)
    rows.push(row)
  }

  for (const neighborhood of byId(dataset.neighborhoods)) {
    const district = districts.get(neighborhood.districtId)
    if (!district) {
      orphans++
      continue
    }
    const town = towns.get(neighborhood.municipalityId)
    rows.push({
      ...district,
      neighborhood_name: town
        ? townNeighborhoodName(neighborhood.name, town)
        : neighborhood.name.trim(),
      neighborhood_external_id: externalId("neighborhood", neighborhood.id),
      neighborhood_kind: "neighborhood",
      postal_code: neighborhood.postalCode,
      postal_code_status: postalStatus(neighborhood.postalCodeStatus),
    })
  }

  for (const village of byId(dataset.villages)) {
    const district = districts.get(village.districtId)
    if (!district) {
      orphans++
      continue
    }
    rows.push({
      ...district,
      neighborhood_name: villageName(village.name),
      neighborhood_external_id: externalId("village", village.id),
      neighborhood_kind: "village",
      postal_code: village.postalCode,
      postal_code_status: postalStatus(village.postalCodeStatus),
    })
  }
  return { rows, orphans }
}
