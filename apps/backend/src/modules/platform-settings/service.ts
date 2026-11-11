import type { Context } from "@medusajs/framework/types"
import {
  InjectManager,
  InjectTransactionManager,
  MedusaContext,
  MedusaError,
} from "@medusajs/framework/utils"
import { createRedisVersionSource, createVersionedCache } from "../../lib/cache"
import type { VersionedCache } from "../../lib/cache"
import { ValidationError, uniqueViolationKeys } from "../../lib/errors"
import { logger } from "../../lib/logging"
import { createRedisClient } from "../../lib/redis"
import type Redis from "ioredis"
import { featureDefinition, featureRegistry } from "./features"
import { PlatformFlagStore, effectiveValue, managedOnly } from "./service-platform-flags"
import type { PlatformFlagSync } from "./service-platform-flags"
import { SECTIONS, mergePatch, sectionOf } from "./sections"
import { parseStored, toValidationError } from "./sections/stored"
import type { SectionName } from "./sections"
import type {
  FeatureChange,
  FeatureState,
  PlatformSettingsModuleOptions,
  SectionChange,
  SectionValues,
  Snapshot,
  StoredSection,
} from "./types"

export type {
  FeatureChange,
  FeatureState,
  PlatformSettingsModuleOptions,
  SectionChange,
  SectionValues,
  SettingsSectionRecord,
  StoredSection,
} from "./types"

export type { PlatformFlagSync } from "./service-platform-flags"

/**
 * Store and SEO settings and feature flags (F2.3, adr/0012). No secrets.
 * The platform flags' stored values are `PlatformFlagStore`'s
 * (service-platform-flags.ts).
 */
class PlatformSettingsModuleService extends PlatformFlagStore {
  private readonly cache: VersionedCache<Snapshot>

  constructor(container: Record<string, unknown>, options: PlatformSettingsModuleOptions = {}) {
    // eslint-disable-next-line prefer-rest-params -- MedusaService needs every constructor argument
    super(...arguments)
    const { redisUrl } = options
    let client: Redis | undefined
    const source = redisUrl
      ? createRedisVersionSource(
          () => (client ??= createRedisClient(redisUrl, "platform_settings")),
          options.versionKey ?? "qt:settings:version"
        )
      : null
    const env = process.env["NODE_ENV"]
    if (!source && env !== "development" && env !== "test") {
      // Each process sees its own writes at once and others' within maxAgeMs
      logger.warn({ event: "platform_settings.no_shared_version", nodeEnv: env ?? null })
    }
    this.cache = createVersionedCache({
      name: "platform_settings",
      source,
      load: () => this.loadSnapshot_(),
    })
  }

  @InjectManager()
  protected async loadSnapshot_(@MedusaContext() sharedContext: Context = {}): Promise<Snapshot> {
    const [rows, overrides, platform] = await Promise.all([
      this.listSettingsSections({}, {}, sharedContext),
      this.listFeatureOverrides({}, {}, sharedContext),
      this.readPlatformFlags(sharedContext),
    ])
    const sections = Object.fromEntries(
      (Object.keys(SECTIONS) as SectionName[]).map((name) => [
        name,
        parseStored(name, rows.find((row) => row.section === name)?.values),
      ])
    ) as Record<SectionName, SectionValues>
    return {
      sections,
      overrides: Object.fromEntries(overrides.map((row) => [row.key, row.enabled])),
      platform,
    }
  }

  /** The section's values, defaults filled in (cached). */
  async getSection(name: SectionName): Promise<SectionValues> {
    return (await this.cache.get()).sections[name]
  }

  /** The section as stored now, bypassing the cache (audit snapshots, compensations). */
  @InjectManager()
  async readSection(
    name: SectionName,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<StoredSection & { values: SectionValues }> {
    const [row] = await this.listSettingsSections({ section: name }, { take: 1 }, sharedContext)
    return { values: parseStored(name, row?.values), version: row?.version ?? 0 }
  }

  /**
   * Merges `patch` over the section's current values, checks the result
   * against the section's schema and stores it (version + 1). Throws a
   * ValidationError with the first problem's key (`seo.template_invalid`).
   */
  async saveSection(
    name: SectionName,
    patch: SectionValues,
    actorId: string | null
  ): Promise<SectionChange> {
    const raw: unknown = patch
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
      throw new ValidationError("platform_settings.invalid", { field: name })
    }
    let change: SectionChange
    try {
      change = await this.saveSectionInTransaction_(name, patch, actorId)
    } catch (error) {
      // A first save racing another inserts the same section twice; the second retries
      if (!uniqueViolationKeys(error)?.includes("section")) {
        throw error
      }
      change = await this.saveSectionInTransaction_(name, patch, actorId)
    }
    await this.cache.invalidate()
    return change
  }

  @InjectTransactionManager()
  protected async saveSectionInTransaction_(
    name: SectionName,
    patch: SectionValues,
    actorId: string | null,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<SectionChange> {
    const section = sectionOf(name)
    const [row] = await this.listSettingsSections({ section: name }, { take: 1 }, sharedContext)
    const before = parseStored(name, row?.values)
    let after: SectionValues
    try {
      after = section.full.parse(mergePatch(before, patch))
    } catch (error) {
      throw toValidationError(error)
    }
    if (row) {
      await this.updateSettingsSections(
        { id: row.id, values: after, version: row.version + 1, updated_by: actorId },
        sharedContext
      )
    } else {
      await this.createSettingsSections(
        { section: name, values: after, updated_by: actorId },
        sharedContext
      )
    }
    return {
      before,
      after,
      previous: row ? { values: row.values, version: row.version } : null,
    }
  }

  /** Puts a section back as it was before a save (workflow compensation). */
  async restoreSection(name: SectionName, previous: StoredSection | null): Promise<void> {
    await this.restoreSectionInTransaction_(name, previous)
    await this.cache.invalidate()
  }

  @InjectTransactionManager()
  protected async restoreSectionInTransaction_(
    name: SectionName,
    previous: StoredSection | null,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    const [row] = await this.listSettingsSections({ section: name }, { take: 1 }, sharedContext)
    if (!row) {
      return
    }
    if (previous === null) {
      await this.deleteSettingsSections(row.id, sharedContext)
      return
    }
    await this.updateSettingsSections(
      { id: row.id, values: previous.values, version: row.version + 1 },
      sharedContext
    )
  }

  /**
   * Whether the flag is on. A key the registry does not know is off, and
   * logged. A platform flag ignores any tenant override: a flag that moved
   * from tenant to platform (a plan feature, F17) keeps no old tenant choice;
   * it takes the plan document's value while the shop is managed (Ek C9).
   */
  async isFeatureEnabled(key: string): Promise<boolean> {
    const definition = featureDefinition(key)
    if (!definition) {
      logger.error({ event: "platform_settings.feature_unknown", key })
      return false
    }
    const { overrides, platform } = await this.cache.get()
    return effectiveValue(definition, { overrides, platform: managedOnly(platform) }, key).enabled
  }

  /** A flag's value as stored now, bypassing the cache (audit snapshots). */
  @InjectManager()
  async readFeature(
    key: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<boolean | null> {
    const definition = featureDefinition(key)
    if (!definition) {
      return null
    }
    const rows = await this.listFeatureOverrides({ key }, { take: 1 }, sharedContext)
    const overrides = Object.fromEntries(rows.map((row) => [row.key, row.enabled]))
    const platform = managedOnly(await this.readPlatformFlags(sharedContext))
    return effectiveValue(definition, { overrides, platform }, key).enabled
  }

  async listFeatures(): Promise<FeatureState[]> {
    const { overrides, platform } = await this.cache.get()
    const values = { overrides, platform: managedOnly(platform) }
    return Object.entries(featureRegistry()).map(([key, definition]) => ({
      key,
      ...definition,
      ...effectiveValue(definition, values, key),
    }))
  }

  /** Turns a tenant flag on or off; a value equal to the default removes the override. */
  async setFeature(key: string, enabled: boolean, actorId: string | null): Promise<FeatureChange> {
    const definition = featureDefinition(key)
    if (!definition) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "features.unknown")
    }
    if (definition.owner !== "tenant") {
      throw new MedusaError(MedusaError.Types.FORBIDDEN, "features.platform_owned")
    }
    const override = enabled === definition.default ? null : enabled
    let previous: boolean | null
    try {
      previous = await this.writeOverride_(key, override, actorId)
    } catch (error) {
      // Two first writes for one flag insert it twice; the second retries
      if (!uniqueViolationKeys(error)?.includes("key")) {
        throw error
      }
      previous = await this.writeOverride_(key, override, actorId)
    }
    await this.cache.invalidate()
    return { before: previous ?? definition.default, after: enabled, previousOverride: previous }
  }

  /**
   * The plan document's platform flags stored with its serial (adr/0061
   * Ek C9; the document's workflow, never the panel). A smaller serial than
   * the stored one writes nothing (review M1). Keys this shop does not have
   * as `owner: platform` are left out and named back.
   */
  async syncPlatformFlags(
    values: Readonly<Record<string, boolean>>,
    serial: number
  ): Promise<PlatformFlagSync> {
    const sync = await this.writePlatformFlags_(values, serial)
    if (sync.written) {
      await this.cache.invalidate()
    }
    return sync
  }

  /** Undoes a sync (workflow compensation) while nothing newer was stored over it. */
  async undoPlatformFlagSync(
    previous: PlatformFlagSync["previous"],
    undoneSerial: number
  ): Promise<void> {
    if (await this.undoPlatformFlagSync_(previous, undoneSerial)) {
      await this.cache.invalidate()
    }
  }

  /** Puts a tenant flag's override back as it was (workflow compensation). */
  async restoreFeature(key: string, previousOverride: boolean | null): Promise<void> {
    if (featureDefinition(key)?.owner !== "tenant") {
      return
    }
    await this.writeOverride_(key, previousOverride, null)
    await this.cache.invalidate()
  }

  // Sets or removes the override; returns the one it replaced (null: none)
  @InjectTransactionManager()
  protected async writeOverride_(
    key: string,
    enabled: boolean | null,
    actorId: string | null,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<boolean | null> {
    const [row] = await this.listFeatureOverrides({ key }, { take: 1 }, sharedContext)
    if (enabled === null) {
      if (row) {
        await this.deleteFeatureOverrides(row.id, sharedContext)
      }
    } else if (row) {
      await this.updateFeatureOverrides({ id: row.id, enabled, updated_by: actorId }, sharedContext)
    } else {
      await this.createFeatureOverrides({ key, enabled, updated_by: actorId }, sharedContext)
    }
    return row?.enabled ?? null
  }
}

export default PlatformSettingsModuleService
