import type { Context } from "@medusajs/framework/types"
import {
  InjectManager,
  InjectTransactionManager,
  MedusaContext,
  MedusaService,
} from "@medusajs/framework/utils"
import { controlPlaneConfig } from "../../lib/control-plane/config"
import { featureDefinition, featureRegistry } from "./features"
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

/** A sync of the document's platform flags, as `syncPlatformFlags` answers. */
export interface PlatformFlagSync {
  /**
   * False when a newer document's flags were already stored, or the rows
   * already said the same (Ek C19 I1: a replayed document): nothing written.
   */
  written: boolean
  /** The stored values and serial before, for a compensation to put back. */
  previous: { values: Record<string, boolean>; serial: number }
  /** Keys not in this shop's registry as `owner: platform`: left alone (a newer control plane). */
  ignored: string[]
}

interface Executor {
  execute: (sql: string, params: unknown[]) => Promise<unknown>
}

interface FlagRow {
  id: string
  key: string
  enabled: boolean
  serial: number
}

const LOCK = "platform_flag:sync"

/** This shop's `owner: platform` keys and their defaults. */
const platformKeys = () =>
  Object.entries(featureRegistry())
    .filter(([, definition]) => definition.owner === "platform")
    .map(([key, definition]) => ({ key, default: definition.default }))

/**
 * The platform flags' stored values (adr/0061 §5.2, Ek C9): the plan
 * document's `platform_flags`, written as the whole registry (a flag the
 * document does not name takes its default) with the document's serial,
 * under one advisory lock. A sync never writes a smaller serial than the
 * stored one (C9 review M1): two applies racing end with the newer
 * document's flags. `PlatformSettingsModuleService` (service.ts) reads
 * them, while the shop is managed.
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

  /** The rows under the lock, with the serial they were written for (0: none). */
  private async lockedRows_(sharedContext: Context): Promise<{ rows: FlagRow[]; serial: number }> {
    await (sharedContext.transactionManager as Executor).execute(
      "SELECT pg_advisory_xact_lock(hashtext(?))",
      [LOCK]
    )
    const rows = (await this.listPlatformFlags(
      {},
      { select: ["id", "key", "enabled", "serial"], take: 500 },
      sharedContext
    )) as unknown as FlagRow[]
    return { rows, serial: Math.max(0, ...rows.map((row) => row.serial)) }
  }

  /**
   * Every registry platform key set to `values` (its default where absent),
   * with `serial`; only the rows that differ are written. Whether any was.
   */
  private async writeAll_(
    rows: FlagRow[],
    values: Readonly<Record<string, boolean>>,
    serial: number,
    sharedContext: Context
  ): Promise<boolean> {
    const keys = platformKeys()
    const gone = rows.filter((row) => !keys.some((each) => each.key === row.key))
    let changed = gone.length > 0
    if (gone.length > 0) {
      await this.deletePlatformFlags(
        gone.map((row) => row.id),
        sharedContext
      )
    }
    for (const flag of keys) {
      const enabled = Object.hasOwn(values, flag.key) ? values[flag.key] === true : flag.default
      const row = rows.find((each) => each.key === flag.key)
      if (!row) {
        await this.createPlatformFlags([{ key: flag.key, enabled, serial }], sharedContext)
        changed = true
      } else if (row.enabled !== enabled || row.serial !== serial) {
        await this.updatePlatformFlags({ id: row.id, enabled, serial }, sharedContext)
        changed = true
      }
    }
    return changed
  }

  @InjectTransactionManager()
  protected async writePlatformFlags_(
    values: Readonly<Record<string, boolean>>,
    serial: number,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<PlatformFlagSync> {
    const ignored = Object.keys(values).filter(
      (key) => featureDefinition(key)?.owner !== "platform"
    )
    const { rows, serial: stored } = await this.lockedRows_(sharedContext)
    const previous = {
      values: Object.fromEntries(rows.map((row) => [row.key, row.enabled])),
      serial: stored,
    }
    if (serial < stored) {
      return { written: false, previous, ignored }
    }
    // Ek C19 I1: the same rows (a replayed document) write nothing and drop no cache
    const written = await this.writeAll_(rows, values, serial, sharedContext)
    return { written, previous, ignored }
  }

  /** Back to `previous`, only while the rows still hold the serial being undone. */
  @InjectTransactionManager()
  protected async undoPlatformFlagSync_(
    previous: PlatformFlagSync["previous"],
    undoneSerial: number,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<boolean> {
    const { rows, serial } = await this.lockedRows_(sharedContext)
    if (serial !== undoneSerial) {
      return false
    }
    if (Object.keys(previous.values).length === 0) {
      if (rows.length > 0) {
        await this.deletePlatformFlags(
          rows.map((row) => row.id),
          sharedContext
        )
      }
      return true
    }
    await this.writeAll_(rows, previous.values, previous.serial, sharedContext)
    return true
  }
}
