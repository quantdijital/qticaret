import type { Context, InferTypeOf } from "@medusajs/framework/types"
import {
  InjectManager,
  InjectTransactionManager,
  MedusaContext,
  MedusaService,
} from "@medusajs/framework/utils"
import { trMatchKey, trNeighborhoodMatchKey } from "../../lib/tr/text"
import type { LevelSummary, LevelWriter } from "./import/batch"
import { applyPlan, required, summarize } from "./import/batch"
import type { DesiredTree } from "./import/collect"
import { collectDesiredTree, districtKeyOf } from "./import/collect"
import type { PlanValues } from "./import/diff"
import { planLevel } from "./import/diff"
import { districtLevel, neighborhoodLevel, provinceLevel } from "./import/levels"
import type { RejectedRow } from "./import/rows"
import { matchByKey } from "./match"
import { TrDistrict } from "./models/district"
import { TrNeighborhood } from "./models/neighborhood"
import { TrProvince } from "./models/province"
import { TrAddressSync } from "./models/sync"

const ALL = { take: null } as const

export type { LevelSummary }
export type TrAddressSyncRecord = InferTypeOf<typeof TrAddressSync>

export interface TrAddressImportReport {
  provinces: LevelSummary
  districts: LevelSummary
  neighborhoods: LevelSummary
  rejected: RejectedRow[]
  /** The import's record, when one was asked for (`sync`). */
  sync_id?: string
}

export interface TrAddressSyncInput {
  source: "turkiyeapi" | "file"
  dataset_version: string | null
  dataset_last_updated: string | null
}

export interface TrAddressImportOptions {
  /** Mark places absent from the input inactive; only for complete datasets. */
  shouldDeactivateMissing?: boolean
  /** Recorded with the import, in its transaction (the status and the weekly check read it). */
  sync?: TrAddressSyncInput
}

export interface TrAddressLookup {
  province?: { id: string; code: string; name: string }
  district?: { id: string; name: string }
  neighborhood?: {
    id: string
    name: string
    postal_code: string
    /** Null for a file's data, which counts as official. */
    postal_code_status: "official" | "derived" | "estimated" | null
  }
  /** False when no neighborhood data is loaded for the district. */
  districtHasNeighborhoods: boolean
}

export interface TrAddressCounts {
  provinces: number
  districts: number
  /** Neighbourhoods and villages together: what an address form lists. */
  neighborhoods: number
  villages: number
}

class TrAddressModuleService extends MedusaService({
  TrProvince,
  TrDistrict,
  TrNeighborhood,
  TrAddressSync,
}) {
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

    const report: TrAddressImportReport = {
      provinces: summarize(provinces.plan),
      districts: summarize(districts.plan),
      neighborhoods: summarize(neighborhoods),
      rejected: tree.rejected,
    }
    if (options.sync) {
      const sync = await this.createTrAddressSyncs(
        {
          ...options.sync,
          report: {
            provinces: report.provinces,
            districts: report.districts,
            neighborhoods: report.neighborhoods,
            rejected: report.rejected.length,
          },
        },
        sharedContext
      )
      report.sync_id = sync.id
    }
    return report
  }

  /** The newest import that went through, if any. */
  @InjectManager()
  async latestSync(
    @MedusaContext() sharedContext: Context = {}
  ): Promise<TrAddressSyncRecord | undefined> {
    const [latest] = await this.listTrAddressSyncs(
      {},
      { order: { created_at: "DESC" }, take: 1 },
      sharedContext
    )
    return latest
  }

  /** How many places an address form offers, by level. */
  @InjectManager()
  async countActive(@MedusaContext() sharedContext: Context = {}): Promise<TrAddressCounts> {
    // One after another: the queries share this call's entity manager
    const one = { select: ["id"], take: 1 }
    const active = { is_active: true }
    const [, provinces] = await this.listAndCountTrProvinces(active, one, sharedContext)
    const [, districts] = await this.listAndCountTrDistricts(active, one, sharedContext)
    const [, neighborhoods] = await this.listAndCountTrNeighborhoods(active, one, sharedContext)
    const [, villages] = await this.listAndCountTrNeighborhoods(
      { ...active, kind: "village" },
      one,
      sharedContext
    )
    return { provinces, districts, neighborhoods, villages }
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
      { select: ["id", "name", "postal_code", "postal_code_status", "match_key"], ...ALL },
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
        postal_code_status: neighborhood.postal_code_status,
      }
    }
    return lookup
  }

  // A plan's rows are the field maps levels.ts builds for each model; the
  // generated create/update methods take them as their DTOs (`as never[]`)
  private async upsertProvinces(tree: DesiredTree, options: LevelOptions, sharedContext: Context) {
    const level = provinceLevel(await this.listTrProvinces({}, ALL, sharedContext), tree)
    const plan = planLevel(level.existing, level.desired, options)
    await applyPlan(plan, {
      create: (data) => this.createTrProvinces(data as never[], sharedContext),
      update: (data) => this.updateTrProvinces(data as never[], sharedContext),
    } satisfies LevelWriter<PlanValues>)
    const all = await this.listTrProvinces({ is_active: true }, ALL, sharedContext)
    return { plan, ids: new Map(all.map((p) => [p.code, p.id])) }
  }

  private async upsertDistricts(
    tree: DesiredTree,
    provinceIds: Map<string, string>,
    options: LevelOptions,
    sharedContext: Context
  ) {
    const stored = await this.listTrDistricts({}, ALL, sharedContext)
    const level = districtLevel(stored, tree, provinceIds)
    const plan = planLevel(level.existing, level.desired, options)
    await applyPlan(plan, {
      create: (data) => this.createTrDistricts(data as never[], sharedContext),
      update: (data) => this.updateTrDistricts(data as never[], sharedContext),
    } satisfies LevelWriter<PlanValues>)
    // Active only: a removed district may share its name with a new one
    const all = await this.listTrDistricts({ is_active: true }, ALL, sharedContext)
    return { plan, ids: new Map(all.map((d) => [districtKeyOf(d.province_id, d.match_key), d.id])) }
  }

  private async upsertNeighborhoods(
    tree: DesiredTree,
    districtIdOf: (provinceCode: string, districtKey: string) => string | undefined,
    options: LevelOptions,
    sharedContext: Context
  ) {
    const stored = await this.listTrNeighborhoods({}, ALL, sharedContext)
    const level = neighborhoodLevel(stored, tree, districtIdOf)
    const plan = planLevel(level.existing, level.desired, options)
    await applyPlan(plan, {
      create: (data) => this.createTrNeighborhoods(data as never[], sharedContext),
      update: (data) => this.updateTrNeighborhoods(data as never[], sharedContext),
    } satisfies LevelWriter<PlanValues>)
    return plan
  }
}

interface LevelOptions {
  shouldDeactivateMissing: boolean
}

export default TrAddressModuleService
