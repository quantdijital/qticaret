import type { Context } from "@medusajs/framework/types"
import {
  InjectManager,
  InjectTransactionManager,
  MedusaContext,
  MedusaService,
} from "@medusajs/framework/utils"
import { controlPlaneConfig } from "../../lib/control-plane/config"
import { featureDefinition } from "./features"
import type { FeatureDefinition } from "./features"
import { FeatureOverride } from "./models/feature-override"
import { PlatformFlag } from "./models/platform-flag"
import { SettingsSection } from "./models/settings-section"
import type { Snapshot } from "./types"

// Own keys only: tenant overrides only for tenant flags; a platform flag
// takes the plan document's value while the shop is managed (adr/0061 Ek
// C9), its default otherwise
export function effectiveValue(
  definition: FeatureDefinition,
  { overrides, platform }: Pick<Snapshot, "overrides" | "platform">,
  key: string
): { enabled: boolean; overridden: boolean } {
  const values = definition.owner === "tenant" ? overrides : platform
  const override = Object.hasOwn(values, key) ? values[key] : undefined
  return { enabled: override ?? definition.default, overridden: override !== undefined }
}

/** The platform flags in force: the document's while managed, none (defaults) otherwise. */
export const managedOnly = (platform: Record<string, boolean>): Record<string, boolean> =>
  controlPlaneConfig().managed ? platform : {}

/** The platform flags a document set, and the keys it named that this shop does not know. */
export interface PlatformFlagSync {
  /** The stored values before, for a compensation to put back. */
  previous: Record<string, boolean>
  /** Keys not in this shop's registry as `owner: platform`: left alone (a newer control plane). */
  ignored: string[]
}

/**
 * The platform flags' stored values (adr/0061 §5.2, Ek C9): the plan
 * document's `platform_flags`, written as a whole set so a flag a document
 * no longer names falls back to its default. Only keys this shop's
 * registry has as `owner: platform` are kept. `PlatformSettingsModuleService`
 * (service.ts) reads them, while the shop is managed.
 */
export class PlatformFlagStore extends MedusaService({
  SettingsSection,
  FeatureOverride,
  PlatformFlag,
}) {
  @InjectManager()
  async readPlatformFlags(
    @MedusaContext() sharedContext: Context = {}
  ): Promise<Record<string, boolean>> {
    const rows = await this.listPlatformFlags({}, { take: 500 }, sharedContext)
    return Object.fromEntries(rows.map((row) => [row.key, row.enabled]))
  }

  @InjectTransactionManager()
  protected async writePlatformFlags_(
    values: Readonly<Record<string, boolean>>,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<PlatformFlagSync> {
    const known = Object.keys(values).filter((key) => featureDefinition(key)?.owner === "platform")
    const ignored = Object.keys(values).filter((key) => !known.includes(key))
    const rows = await this.listPlatformFlags({}, { take: 500 }, sharedContext)
    const previous = Object.fromEntries(rows.map((row) => [row.key, row.enabled]))
    const gone = rows.filter((row) => !known.includes(row.key)).map((row) => row.id)
    if (gone.length > 0) {
      await this.deletePlatformFlags(gone, sharedContext)
    }
    for (const key of known) {
      const enabled = values[key] === true
      const row = rows.find((each) => each.key === key)
      if (!row) {
        await this.createPlatformFlags([{ key, enabled }], sharedContext)
      } else if (row.enabled !== enabled) {
        await this.updatePlatformFlags({ id: row.id, enabled }, sharedContext)
      }
    }
    return { previous, ignored }
  }
}
