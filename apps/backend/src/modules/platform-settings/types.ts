import type { InferTypeOf } from "@medusajs/framework/types"
import type { FeatureDefinition } from "./features"
import type { SettingsSection } from "./models/settings-section"
import type { SectionName } from "./sections"

export type SettingsSectionRecord = InferTypeOf<typeof SettingsSection>
export type SectionValues = Record<string, unknown>

export interface PlatformSettingsModuleOptions {
  /** Shared version counter across processes; without it each process trusts its own writes. */
  redisUrl?: string
  versionKey?: string
}

export interface StoredSection {
  values: SectionValues
  version: number
}

export interface SectionChange {
  before: SectionValues
  after: SectionValues
  /** The row before the change, for a compensation to put back; null when there was none. */
  previous: StoredSection | null
  /** The version this save wrote: a compensation puts `previous` back only over it. */
  version: number
}

export interface FeatureState extends FeatureDefinition {
  key: string
  enabled: boolean
  overridden: boolean
}

export interface FeatureChange {
  before: boolean
  after: boolean
  /** The override before the change, for a compensation; null when there was none. */
  previousOverride: boolean | null
}

export interface Snapshot {
  sections: Record<SectionName, SectionValues>
  overrides: Record<string, boolean>
  /** The plan document's platform flags as stored (adr/0061 Ek C9); applied while managed. */
  platform: Record<string, boolean>
}
