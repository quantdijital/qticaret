import type { Context } from "@medusajs/framework/types"
import {
  InjectManager,
  InjectTransactionManager,
  MedusaContext,
  MedusaService,
} from "@medusajs/framework/utils"
import { trMatchKey, trNeighborhoodMatchKey, trSortKey } from "../../lib/tr/text"
import { collectDesiredTree, districtKeyOf } from "./import/collect"
import type { LevelPlan } from "./import/diff"
import { planLevel } from "./import/diff"
import type { RejectedRow } from "./import/rows"
import { TrDistrict } from "./models/district"
import { TrNeighborhood } from "./models/neighborhood"
import { TrProvince } from "./models/province"

const BATCH_SIZE = 1000

export interface LevelSummary {
  created: number
  updated: number
  deactivated: number
  unchanged: number
}

export interface TrAddressImportReport {
  provinces: LevelSummary
  districts: LevelSummary
  neighborhoods: LevelSummary
  rejected: RejectedRow[]
}

export interface TrAddressLookup {
  province?: { id: string; code: string; name: string }
  district?: { id: string; name: string }
  neighborhood?: { id: string; name: string; postal_code: string }
  /** False when no neighborhood data is loaded for the district. */
  districtHasNeighborhoods: boolean
}

const ALL = { take: null } as const

class TrAddressModuleService extends MedusaService({ TrProvince, TrDistrict, TrNeighborhood }) {
  /**
   * Idempotent upsert of reference data from normalized rows (adr/0008).
   * Runs in one transaction: a failure leaves the previous data intact.
   */
  @InjectTransactionManager()
  async importReferenceData(
    rawRows: unknown[],
    options: { deactivateMissing?: boolean } = {},
    @MedusaContext() sharedContext: Context = {}
  ): Promise<TrAddressImportReport> {
    const tree = collectDesiredTree(rawRows)
    const levelOptions = { deactivateMissing: options.deactivateMissing ?? false }

    const provinces = await this.listTrProvinces({}, ALL, sharedContext)
    const provincePlan = planLevel(
      provinces.map((p) => ({
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
      levelOptions
    )
    await this.applyPlan(provincePlan, {
      create: (data) => this.createTrProvinces(data, sharedContext),
      update: (data) => this.updateTrProvinces(data, sharedContext),
    })

    const provinceIds = new Map(
      (await this.listTrProvinces({}, ALL, sharedContext)).map((p) => [p.code, p.id])
    )
    const districts = await this.listTrDistricts({}, ALL, sharedContext)
    const districtPlan = planLevel(
      districts.map((d) => ({
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
      levelOptions
    )
    await this.applyPlan(districtPlan, {
      create: (data) => this.createTrDistricts(data, sharedContext),
      update: (data) => this.updateTrDistricts(data, sharedContext),
    })

    const districtIds = new Map(
      (await this.listTrDistricts({}, ALL, sharedContext)).map((d) => [
        districtKeyOf(d.province_id, d.match_key),
        d.id,
      ])
    )
    const neighborhoods = await this.listTrNeighborhoods({}, ALL, sharedContext)
    const neighborhoodPlan = planLevel(
      neighborhoods.map((n) => ({
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
        const provinceId = required(provinceIds.get(n.provinceCode))
        const districtId = required(districtIds.get(districtKeyOf(provinceId, n.districtKey)))
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
      levelOptions
    )
    await this.applyPlan(neighborhoodPlan, {
      create: (data) => this.createTrNeighborhoods(data, sharedContext),
      update: (data) => this.updateTrNeighborhoods(data, sharedContext),
    })

    return {
      provinces: summarize(provincePlan),
      districts: summarize(districtPlan),
      neighborhoods: summarize(neighborhoodPlan),
      rejected: tree.rejected,
    }
  }

  /** Active reference records matching an address's names, for validation (F1.4). */
  @InjectManager()
  async lookupAddress(
    input: { province?: string; district?: string; neighborhood?: string },
    @MedusaContext() sharedContext: Context = {}
  ): Promise<TrAddressLookup> {
    const lookup: TrAddressLookup = { districtHasNeighborhoods: false }
    if (!input.province) {
      return lookup
    }
    const [province] = await this.listTrProvinces(
      { match_key: trMatchKey(input.province), is_active: true },
      { select: ["id", "code", "name"], take: 1 },
      sharedContext
    )
    if (!province) {
      return lookup
    }
    lookup.province = { id: province.id, code: province.code, name: province.name }
    if (!input.district) {
      return lookup
    }

    const [district] = await this.listTrDistricts(
      { province_id: province.id, match_key: trMatchKey(input.district), is_active: true },
      { select: ["id", "name"], take: 1 },
      sharedContext
    )
    if (!district) {
      return lookup
    }
    lookup.district = { id: district.id, name: district.name }
    const [, neighborhoodCount] = await this.listAndCountTrNeighborhoods(
      { district_id: district.id, is_active: true },
      { select: ["id"], take: 1 },
      sharedContext
    )
    lookup.districtHasNeighborhoods = neighborhoodCount > 0
    if (!input.neighborhood) {
      return lookup
    }

    const [neighborhood] = await this.listTrNeighborhoods(
      {
        district_id: district.id,
        match_key: trNeighborhoodMatchKey(input.neighborhood),
        is_active: true,
      },
      { select: ["id", "name", "postal_code"], take: 1 },
      sharedContext
    )
    if (neighborhood) {
      lookup.neighborhood = neighborhood
    }
    return lookup
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

function chunk<T>(items: T[]): T[][] {
  const batches: T[][] = []
  for (let start = 0; start < items.length; start += BATCH_SIZE) {
    batches.push(items.slice(start, start + BATCH_SIZE))
  }
  return batches
}

function summarize(plan: LevelPlan<unknown>): LevelSummary {
  return {
    created: plan.create.length,
    updated: plan.update.length,
    deactivated: plan.deactivate.length,
    unchanged: plan.unchanged,
  }
}

function required<T>(value: T | undefined): T {
  if (value === undefined) {
    throw new Error("tr-address import: parent record missing after upsert")
  }
  return value
}

export default TrAddressModuleService
