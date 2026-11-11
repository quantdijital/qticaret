import type { Context } from "@medusajs/framework/types"
import {
  InjectManager,
  InjectTransactionManager,
  MedusaContext,
  MedusaService,
} from "@medusajs/framework/utils"
import { Package } from "./models/package"
import { PackageFeature } from "./models/package-feature"
import { PackageLimit } from "./models/package-limit"
import { TenantFeatureOverride } from "./models/tenant-feature-override"
import { TenantOverride } from "./models/tenant-override"
import { TenantPlan } from "./models/tenant-plan"
import { FEATURE_OVERRIDE_FIELDS } from "./types"
import type { FeatureOverrideRecord, FeaturePatch } from "./types"

/**
 * The plans module's platform flags (adr/0061 §2 `package_feature`, Ek C9):
 * a package's values and a shop's exceptions to them. Which keys exist is
 * the shared list's (`PLATFORM_FLAGS`); the routes refuse any other, so
 * these methods take keys as given. `PlansModuleService` (service.ts)
 * holds the packages, limits and assignments.
 */
export class PlansFeatures extends MedusaService({
  Package,
  PackageLimit,
  PackageFeature,
  TenantPlan,
  TenantOverride,
  TenantFeatureOverride,
}) {
  /** A package's flags set (`true`/`false`) or back to the default (`null`). */
  @InjectTransactionManager()
  async setPackageFeatures(
    packageId: string,
    patch: FeaturePatch,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    const rows = (await this.listPackageFeatures(
      { package_id: packageId },
      { select: ["id", "key"], take: 200 },
      sharedContext
    )) as unknown as { id: string; key: string }[]
    for (const [key, enabled] of Object.entries(patch)) {
      const row = rows.find((each) => each.key === key)
      if (enabled === null) {
        if (row) {
          await this.deletePackageFeatures([row.id], sharedContext)
        }
      } else if (row) {
        await this.updatePackageFeatures({ id: row.id, enabled }, sharedContext)
      } else {
        await this.createPackageFeatures([{ package_id: packageId, key, enabled }], sharedContext)
      }
    }
  }

  @InjectManager()
  async featureOverridesOf(
    tenantId: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<FeatureOverrideRecord[]> {
    return await this.listTenantFeatureOverrides(
      { tenant_id: tenantId },
      { select: [...FEATURE_OVERRIDE_FIELDS], order: { created_at: "ASC" }, take: 200 },
      sharedContext
    )
  }

  /**
   * A shop's exception for one platform flag set (`input`) or removed
   * (`null`); the exception as it was comes back to undo it.
   */
  @InjectTransactionManager()
  async setFeatureOverride(
    tenantId: string,
    key: string,
    input: Omit<FeatureOverrideRecord, "id" | "tenant_id" | "key" | "created_at"> | null,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<{ before: FeatureOverrideRecord | null }> {
    const before = (await this.featureOverridesOf(tenantId, sharedContext)).find(
      (each) => each.key === key
    )
    if (before) {
      await this.deleteTenantFeatureOverrides([before.id], sharedContext)
    }
    if (input) {
      await this.createTenantFeatureOverrides(
        [{ tenant_id: tenantId, key, ...input }],
        sharedContext
      )
    }
    return { before: before ?? null }
  }
}
