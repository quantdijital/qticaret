import { trMatchKey, trSortKey } from "../../../lib/tr/text"
import { required } from "./batch"
import type { DesiredTree } from "./collect"
import { districtKeyOf } from "./collect"
import type { DesiredRecord, ExistingRecord, PlanValues } from "./diff"

/**
 * Each level's stored records and wanted records as the diff reads them
 * (diff.ts): a natural key, the source's id where there is one, and the
 * fields compared and written. A field the source does not give (a file
 * has no ids, kinds or postal code statuses) is left out, so it is kept.
 */

interface StoredProvince {
  id: string
  code: string
  name: string
  match_key: string
  sort_key: string
  is_active: boolean
}

interface StoredDistrict {
  id: string
  province_id: string
  name: string
  match_key: string
  sort_key: string
  is_active: boolean
  external_id: string | null
}

interface StoredNeighborhood {
  id: string
  district_id: string
  name: string
  postal_code: string
  match_key: string
  sort_key: string
  is_active: boolean
  external_id: string | null
  kind: string
  postal_code_status: string | null
}

interface Plan {
  existing: ExistingRecord<PlanValues>[]
  desired: DesiredRecord<PlanValues>[]
}

export const neighborhoodKeyOf = (districtId: string, matchKey: string) =>
  `${districtId}|${matchKey}`

export function provinceLevel(stored: StoredProvince[], tree: DesiredTree): Plan {
  return {
    existing: stored.map((p) => ({
      id: p.id,
      key: p.code,
      is_active: p.is_active,
      values: { code: p.code, name: p.name, match_key: p.match_key, sort_key: p.sort_key },
    })),
    desired: [...tree.provinces.values()].map((p) => ({
      key: p.code,
      values: {
        code: p.code,
        name: p.name,
        match_key: trMatchKey(p.name),
        sort_key: trSortKey(p.name),
      },
    })),
  }
}

export function districtLevel(
  stored: StoredDistrict[],
  tree: DesiredTree,
  provinceIds: Map<string, string>
): Plan {
  return {
    existing: stored.map((d) => ({
      id: d.id,
      key: districtKeyOf(d.province_id, d.match_key),
      externalId: d.external_id,
      is_active: d.is_active,
      values: {
        province_id: d.province_id,
        name: d.name,
        match_key: d.match_key,
        sort_key: d.sort_key,
        external_id: d.external_id,
      },
    })),
    desired: [...tree.districts.values()].map((d) => {
      const provinceId = required(provinceIds.get(d.provinceCode))
      return {
        key: districtKeyOf(provinceId, d.key),
        externalId: d.externalId,
        values: {
          province_id: provinceId,
          name: d.name,
          match_key: d.key,
          sort_key: trSortKey(d.name),
          ...(d.externalId ? { external_id: d.externalId } : {}),
        },
      }
    }),
  }
}

export function neighborhoodLevel(
  stored: StoredNeighborhood[],
  tree: DesiredTree,
  districtIdOf: (provinceCode: string, districtKey: string) => string | undefined
): Plan {
  return {
    existing: stored.map((n) => ({
      id: n.id,
      key: neighborhoodKeyOf(n.district_id, n.match_key),
      externalId: n.external_id,
      is_active: n.is_active,
      values: {
        district_id: n.district_id,
        name: n.name,
        postal_code: n.postal_code,
        match_key: n.match_key,
        sort_key: n.sort_key,
        external_id: n.external_id,
        kind: n.kind,
        postal_code_status: n.postal_code_status,
      },
    })),
    desired: [...tree.neighborhoods.values()].map((n) => {
      const districtId = required(districtIdOf(n.provinceCode, n.districtKey))
      return {
        key: neighborhoodKeyOf(districtId, n.key),
        externalId: n.externalId,
        values: {
          district_id: districtId,
          name: n.name,
          postal_code: n.postalCode,
          match_key: n.key,
          sort_key: trSortKey(n.name),
          ...(n.externalId ? { external_id: n.externalId } : {}),
          ...(n.kind ? { kind: n.kind } : {}),
          ...(n.postalCodeStatus ? { postal_code_status: n.postalCodeStatus } : {}),
        },
      }
    }),
  }
}
