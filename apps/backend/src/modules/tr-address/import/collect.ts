import type { RejectedRow } from "./rows"
import { parseTrAddressRow } from "./rows"

export interface DesiredProvince {
  code: string
  name: string
}

export interface DesiredDistrict {
  provinceCode: string
  name: string
  key: string
}

export interface DesiredNeighborhood {
  provinceCode: string
  districtKey: string
  name: string
  key: string
  postalCode: string
}

export interface DesiredTree {
  provinces: Map<string, DesiredProvince>
  districts: Map<string, DesiredDistrict>
  neighborhoods: Map<string, DesiredNeighborhood>
  rejected: RejectedRow[]
}

export const districtKeyOf = (provinceRef: string, districtKey: string) =>
  `${provinceRef}|${districtKey}`

/**
 * Turns flat rows into the province/district/neighborhood sets the import
 * should end with. The first spelling of a place wins; a row that
 * contradicts an earlier one is rejected instead of silently overwriting it.
 */
export function collectDesiredTree(rawRows: unknown[]): DesiredTree {
  const tree: DesiredTree = {
    provinces: new Map(),
    districts: new Map(),
    neighborhoods: new Map(),
    rejected: [],
  }

  rawRows.forEach((raw, index) => {
    const reject = (reason: string) => tree.rejected.push({ row: index + 1, reason })
    const parsed = parseTrAddressRow(raw)
    if (!parsed.ok) {
      reject(parsed.reason)
      return
    }
    const { row } = parsed

    const province = tree.provinces.get(row.provinceCode)
    if (province && province.name !== row.provinceName) {
      reject("province_name_conflict")
      return
    }
    const districtId = districtKeyOf(row.provinceCode, row.districtKey)
    const neighborhoodId = row.neighborhood ? `${districtId}|${row.neighborhood.key}` : null
    const existingNeighborhood = neighborhoodId ? tree.neighborhoods.get(neighborhoodId) : null
    if (existingNeighborhood && existingNeighborhood.postalCode !== row.neighborhood?.postalCode) {
      reject("neighborhood_postal_code_conflict")
      return
    }

    tree.provinces.set(row.provinceCode, { code: row.provinceCode, name: row.provinceName })
    if (!tree.districts.has(districtId)) {
      tree.districts.set(districtId, {
        provinceCode: row.provinceCode,
        name: row.districtName,
        key: row.districtKey,
      })
    }
    if (row.neighborhood && neighborhoodId && !existingNeighborhood) {
      tree.neighborhoods.set(neighborhoodId, {
        provinceCode: row.provinceCode,
        districtKey: row.districtKey,
        name: row.neighborhood.name,
        key: row.neighborhood.key,
        postalCode: row.neighborhood.postalCode,
      })
    }
  })
  return tree
}
