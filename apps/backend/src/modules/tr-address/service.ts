import type { Context } from "@medusajs/framework/types"
import {
  InjectManager,
  InjectTransactionManager,
  MedusaContext,
  MedusaService,
} from "@medusajs/framework/utils"
import { trMatchKey, trNeighborhoodMatchKey, trSortKey } from "../../lib/tr/text"
import type { LevelSummary } from "./import/batch"
import { chunk, required, summarize } from "./import/batch"
import type { DesiredTree } from "./import/collect"
import { collectDesiredTree, districtKeyOf } from "./import/collect"
import type { LevelPlan } from "./import/diff"
import { planLevel } from "./import/diff"
import type { RejectedRow } from "./import/rows"
import { matchByKey } from "./match"
import { TrDistrict } from "./models/district"
import { TrNeighborhood } from "./models/neighborhood"
import { TrProvince } from "./models/province"

const ALL = { take: null } as const

export type { LevelSummary }

export interface TrAddressImportReport {
  provinces: LevelSummary
  districts: LevelSummary
  neighborhoods: LevelSummary
  rejected: RejectedRow[]
}

export interface TrAddressImportOptions {
  /** Mark places absent from the input inactive; only for complete datasets. */
  shouldDeactivateMissing?: boolean
}

export interface TrAddressLookup {
  province?: { id: string; code: string; name: string }
  district?: { id: string; name: string }
  neighborhood?: { id: string; name: string; postal_code: string }
  /** False when no neighborhood data is loaded for the district. */
  districtHasNeighborhoods: boolean
}

interface LevelOptions {
  shouldDeactivateMissing: boolean
}

class TrAddressModuleService extends MedusaService({ TrProvince, TrDistrict, TrNeighborhood }) {
  /**
   * Idempotent upsert of reference data from normalized rows (adr/0008).
   * Runs in one transaction: a failure leaves the previous data intact.
   */
  @InjectTransactionManager()
  async importReferenceData(
    rawRows: unknown[],
    options: TrAddressImportOptions = {},
    @MedusaContext() sharedContext: Context = {}
  ): Promise<TrAddressImportReport> {
    const tree = collectDesiredTree(rawRows)
    const levelOptions = { shouldDeactivateMissing: options.shouldDeactivateMissing ?? false }

    const provinces = await this.upsertProvinces(tree, levelOptions, sharedContext)
    const districts = await this.upsertDistricts(tree, provinces.ids, levelOptions, sharedContext)
    const neighborhoods = await this.upsertNeighborhoods(
      tree,
      (provinceCode, districtKey) =>
        districts.ids.get(districtKeyOf(required(provinces.ids.get(provinceCode)), districtKey)),
      levelOptions,
      sharedContext
    )

    return {
      provinces: summarize(provinces.plan),
      districts: summarize(districts.plan),
      neighborhoods: summarize(neighborhoods),
      rejected: tree.rejected,
    }
  }

  /**
   * Active reference records matching an address's names, for validation
   * (F1.4). Names match case-insensitively with Turkish casing; input typed
   * without Turkish letters matches when it points to a single place.
   */
  @InjectManager()
  async lookupAddress(
    input: { province?: string; district?: string; neighborhood?: string },
    @MedusaContext() sharedContext: Context = {}
  ): Promise<TrAddressLookup> {
    const lookup: TrAddressLookup = { districtHasNeighborhoods: false }
    if (!input.province) {
      return lookup
    }
    const provinceKey = trMatchKey(input.province)
    const select = { select: ["id", "code", "name", "match_key"] }
    const [exactProvince] = await this.listTrProvinces(
      { match_key: provinceKey, is_active: true },
      { ...select, take: 1 },
      sharedContext
    )
    const province =
      exactProvince ??
      matchByKey(
        await this.listTrProvinces({ is_active: true }, { ...select, ...ALL }, sharedContext),
        provinceKey
      )
    if (!province) {
      return lookup
    }
    lookup.province = { id: province.id, code: province.code, name: province.name }
    if (!input.district) {
      return lookup
    }

    const districts = await this.listTrDistricts(
      { province_id: province.id, is_active: true },
      { select: ["id", "name", "match_key"], ...ALL },
      sharedContext
    )
    const district = matchByKey(districts, trMatchKey(input.district))
    if (!district) {
      return lookup
    }
    lookup.district = { id: district.id, name: district.name }

    const neighborhoods = await this.listTrNeighborhoods(
      { district_id: district.id, is_active: true },
      { select: ["id", "name", "postal_code", "match_key"], ...ALL },
      sharedContext
    )
    lookup.districtHasNeighborhoods = neighborhoods.length > 0
    const neighborhood = input.neighborhood
      ? matchByKey(neighborhoods, trNeighborhoodMatchKey(input.neighborhood))
      : undefined
    if (neighborhood) {
      lookup.neighborhood = {
        id: neighborhood.id,
        name: neighborhood.name,
        postal_code: neighborhood.postal_code,
      }
    }
    return lookup
  }

  private async upsertProvinces(tree: DesiredTree, options: LevelOptions, sharedContext: Context) {
    const existing = await this.listTrProvinces({}, ALL, sharedContext)
    const plan = planLevel(
      existing.map((p) => ({
        id: p.id,
        key: p.code,
        is_active: p.is_active,
        values: { code: p.code, name: p.name, match_key: p.match_key, sort_key: p.sort_key },
      })),
      [...tree.provinces.values()].map((p) => ({
        key: p.code,
        values: {
          code: p.code,
          name: p.name,
          match_key: trMatchKey(p.name),
          sort_key: trSortKey(p.name),
        },
      })),
      options
    )
    await this.applyPlan(plan, {
      create: (data) => this.createTrProvinces(data, sharedContext),
      update: (data) => this.updateTrProvinces(data, sharedContext),
    })
    const all = await this.listTrProvinces({}, ALL, sharedContext)
    return { plan, ids: new Map(all.map((p) => [p.code, p.id])) }
  }

  private async upsertDistricts(
    tree: DesiredTree,
    provinceIds: Map<string, string>,
    options: LevelOptions,
    sharedContext: Context
  ) {
    const existing = await this.listTrDistricts({}, ALL, sharedContext)
    const plan = planLevel(
      existing.map((d) => ({
        id: d.id,
        key: districtKeyOf(d.province_id, d.match_key),
        is_active: d.is_active,
        values: {
          province_id: d.province_id,
          name: d.name,
          match_key: d.match_key,
          sort_key: d.sort_key,
        },
      })),
      [...tree.districts.values()].map((d) => {
        const provinceId = required(provinceIds.get(d.provinceCode))
        return {
          key: districtKeyOf(provinceId, d.key),
          values: {
            province_id: provinceId,
            name: d.name,
            match_key: d.key,
            sort_key: trSortKey(d.name),
          },
        }
      }),
      options
    )
    await this.applyPlan(plan, {
      create: (data) => this.createTrDistricts(data, sharedContext),
      update: (data) => this.updateTrDistricts(data, sharedContext),
    })
    const all = await this.listTrDistricts({}, ALL, sharedContext)
    return { plan, ids: new Map(all.map((d) => [districtKeyOf(d.province_id, d.match_key), d.id])) }
  }

  private async upsertNeighborhoods(
    tree: DesiredTree,
    districtIdOf: (provinceCode: string, districtKey: string) => string | undefined,
    options: LevelOptions,
    sharedContext: Context
  ) {
    const existing = await this.listTrNeighborhoods({}, ALL, sharedContext)
    const plan = planLevel(
      existing.map((n) => ({
        id: n.id,
        key: `${n.district_id}|${n.match_key}`,
        is_active: n.is_active,
        values: {
          district_id: n.district_id,
          name: n.name,
          postal_code: n.postal_code,
          match_key: n.match_key,
          sort_key: n.sort_key,
        },
      })),
      [...tree.neighborhoods.values()].map((n) => {
        const districtId = required(districtIdOf(n.provinceCode, n.districtKey))
        return {
          key: `${districtId}|${n.key}`,
          values: {
            district_id: districtId,
            name: n.name,
            postal_code: n.postalCode,
            match_key: n.key,
            sort_key: trSortKey(n.name),
          },
        }
      }),
      options
    )
    await this.applyPlan(plan, {
      create: (data) => this.createTrNeighborhoods(data, sharedContext),
      update: (data) => this.updateTrNeighborhoods(data, sharedContext),
    })
    return plan
  }

  private async applyPlan<T>(
    plan: LevelPlan<T>,
    write: { create: (data: T[]) => Promise<unknown>; update: (data: object[]) => Promise<unknown> }
  ): Promise<void> {
    for (const batch of chunk(plan.create)) {
      await write.create(batch)
    }
    for (const batch of chunk(plan.update)) {
      await write.update(batch)
    }
    for (const batch of chunk(plan.deactivate)) {
      await write.update(batch.map((id) => ({ id, is_active: false })))
    }
  }
}

export default TrAddressModuleService
