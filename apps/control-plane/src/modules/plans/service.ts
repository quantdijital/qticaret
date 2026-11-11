import type { Context } from "@medusajs/framework/types"
import {
  InjectManager,
  InjectTransactionManager,
  MedusaContext,
  MedusaError,
  MedusaService,
} from "@medusajs/framework/utils"
import { LIMIT_KEYS } from "@qticaret/types/control-plane"
import type { LimitKey } from "@qticaret/types/control-plane"
import { fullLimits } from "../../lib/plans/limits"
import type { LimitValues } from "../../lib/plans/limits"
import { Package } from "./models/package"
import { PackageLimit } from "./models/package-limit"
import { TenantOverride } from "./models/tenant-override"
import { TenantPlan } from "./models/tenant-plan"
import { PACKAGE_FIELDS, OVERRIDE_FIELDS } from "./types"
import type { OverrideRecord, PackageFields, PackagePatch, PackageRecord } from "./types"

interface Executor {
  execute: (sql: string, params: unknown[]) => Promise<unknown>
}

const PLAN_PAGE = 1000

interface PackageRow extends Omit<PackageRecord, "limits"> {
  limits?: { key: LimitKey; value: number | null }[]
}

const asRecord = (row: PackageRow): PackageRecord => ({
  ...row,
  limits: fullLimits(Object.fromEntries((row.limits ?? []).map((each) => [each.key, each.value]))),
})

/**
 * Packages and who is on them (adr/0061 §2): a package's price, period,
 * days and limits; the package each shop is on; a shop's exceptions. An
 * archived package keeps its shops and takes no new one.
 */
class PlansModuleService extends MedusaService({
  Package,
  PackageLimit,
  TenantPlan,
  TenantOverride,
}) {
  /** Packages with their limits, oldest first; archived ones only when asked. */
  @InjectManager()
  async packages(
    filter: { archived?: boolean; id?: string | string[] } = {},
    @MedusaContext() sharedContext: Context = {}
  ): Promise<PackageRecord[]> {
    const rows = await this.listPackages(
      {
        ...(filter.id ? { id: filter.id } : {}),
        ...(filter.archived === undefined
          ? {}
          : { archived_at: filter.archived ? { $ne: null } : null }),
      },
      {
        select: [...PACKAGE_FIELDS, "limits.key", "limits.value"],
        relations: ["limits"],
        order: { price: "ASC", created_at: "ASC" },
        take: 200,
      },
      sharedContext
    )
    return (rows as unknown as PackageRow[]).map(asRecord)
  }

  /** The package, or 404 `cp.package_unknown`. */
  @InjectManager()
  async packageOf(id: string, @MedusaContext() sharedContext: Context = {}) {
    const [found] = await this.packages({ id }, sharedContext)
    if (!found) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "cp.package_unknown")
    }
    return found
  }

  /** How many shops are on each package. */
  @InjectManager()
  async tenantCounts(@MedusaContext() sharedContext: Context = {}): Promise<Map<string, number>> {
    const rows = (await (sharedContext.manager as Executor).execute(
      `SELECT package_id, count(*)::int AS n FROM tenant_plan
        WHERE deleted_at IS NULL GROUP BY package_id`,
      []
    )) as { package_id: string; n: number }[]
    return new Map(rows.map((row) => [row.package_id, row.n]))
  }

  /** A new package with every registry limit (null where not given). */
  @InjectTransactionManager()
  async createPackage(
    fields: PackageFields & { code: string; limits: Partial<LimitValues> },
    @MedusaContext() sharedContext: Context = {}
  ): Promise<string> {
    const [same] = await this.listPackages({ code: fields.code }, { take: 1 }, sharedContext)
    if (same) {
      throw new MedusaError(MedusaError.Types.DUPLICATE_ERROR, "cp.package_code_taken")
    }
    const { limits, ...rest } = fields
    const [made] = await this.createPackages([rest], sharedContext)
    const id = made?.id ?? ""
    const values = fullLimits(limits)
    await this.createPackageLimits(
      LIMIT_KEYS.map((key) => ({ package_id: id, key, value: values[key] })),
      sharedContext
    )
    return id
  }

  /** A package's fields and limits set; the package as it was comes back to undo it. */
  @InjectTransactionManager()
  async updatePackage(
    id: string,
    patch: PackagePatch,
    limits: Partial<LimitValues> | undefined,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<PackageRecord> {
    const before = await this.packageOf(id, sharedContext)
    const fields = Object.fromEntries(
      Object.entries(patch).filter(([, value]) => value !== undefined)
    )
    if (Object.keys(fields).length > 0) {
      await this.updatePackages({ id, ...fields }, sharedContext)
    }
    if (limits) {
      for (const key of LIMIT_KEYS) {
        if (key in limits) {
          await this.updatePackageLimits(
            { selector: { package_id: id, key }, data: { value: limits[key] ?? null } },
            sharedContext
          )
        }
      }
    }
    return before
  }

  /** The package a shop is on, with its limits; null for none. */
  @InjectManager()
  async planOf(
    tenantId: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<PackageRecord | null> {
    const [plan] = await this.listTenantPlans(
      { tenant_id: tenantId },
      { select: ["package_id"], take: 1 },
      sharedContext
    )
    const packageId = (plan as { package_id?: string } | undefined)?.package_id
    return packageId ? ((await this.packages({ id: packageId }, sharedContext))[0] ?? null) : null
  }

  /** Several shops' packages by shop id (the list), and the shops on one package. */
  @InjectManager()
  async plansOf(
    filter: { tenant_id?: string[]; package_id?: string },
    @MedusaContext() sharedContext: Context = {}
  ): Promise<Map<string, string>> {
    // Page by page: a list cut short would drop shops from a package's filter
    const plans = new Map<string, string>()
    for (let skip = 0; ; skip += PLAN_PAGE) {
      const rows = (await this.listTenantPlans(
        filter,
        { select: ["tenant_id", "package_id"], order: { id: "ASC" }, skip, take: PLAN_PAGE },
        sharedContext
      )) as unknown as { tenant_id: string; package_id: string }[]
      for (const row of rows) {
        plans.set(row.tenant_id, row.package_id)
      }
      if (rows.length < PLAN_PAGE) {
        return plans
      }
    }
  }

  /**
   * A shop put on a package (or taken off, `null`); an archived package
   * takes no new shop (`cp.package_archived`). The package it was on comes
   * back to undo it.
   */
  @InjectTransactionManager()
  async assignPlan(
    tenantId: string,
    packageId: string | null,
    assignedBy: string | null,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<{ before: string | null }> {
    const [current] = (await this.listTenantPlans(
      { tenant_id: tenantId },
      { select: ["id", "package_id"], take: 1 },
      sharedContext
    )) as unknown as { id: string; package_id: string }[]
    const before = current?.package_id ?? null
    if (packageId !== null && packageId !== before) {
      const chosen = await this.packageOf(packageId, sharedContext)
      if (chosen.archived_at !== null) {
        throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "cp.package_archived")
      }
    }
    if (current && packageId === null) {
      await this.deleteTenantPlans([current.id], sharedContext)
    } else if (current && packageId !== null) {
      await this.updateTenantPlans(
        { id: current.id, package_id: packageId, assigned_by: assignedBy },
        sharedContext
      )
    } else if (packageId !== null) {
      await this.createTenantPlans(
        [{ tenant_id: tenantId, package_id: packageId, assigned_by: assignedBy }],
        sharedContext
      )
    }
    return { before }
  }

  @InjectManager()
  async overridesOf(
    tenantId: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<OverrideRecord[]> {
    return await this.listTenantOverrides(
      { tenant_id: tenantId },
      { select: [...OVERRIDE_FIELDS], order: { created_at: "ASC" }, take: 100 },
      sharedContext
    )
  }

  /**
   * A shop's exception for one limit set (`input`) or removed (`null`).
   * The exception as it was comes back to undo it, and `restore` puts it
   * back the same way.
   */
  @InjectTransactionManager()
  async setOverride(
    tenantId: string,
    key: LimitKey,
    input: Omit<OverrideRecord, "id" | "tenant_id" | "key" | "created_at"> | null,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<{ before: OverrideRecord | null }> {
    const before = (await this.overridesOf(tenantId, sharedContext)).find((o) => o.key === key)
    if (before) {
      await this.deleteTenantOverrides([before.id], sharedContext)
    }
    if (input) {
      await this.createTenantOverrides([{ tenant_id: tenantId, key, ...input }], sharedContext)
    }
    return { before: before ?? null }
  }
}

export default PlansModuleService
