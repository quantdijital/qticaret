import type { BillingPeriod, LimitKey } from "@qticaret/types/control-plane"
import type { LimitValues } from "../../lib/plans/limits"

export interface PackageFields {
  name: string
  /** Kuruş, TRY. */
  price: number
  period: BillingPeriod
  trial_days: number
  grace_days: number
}

/** A package's fields to change; one left out (or undefined) is kept. */
export type PackagePatch = { [K in keyof PackageFields]?: PackageFields[K] | undefined } & {
  archived_at?: Date | null | undefined
}

export interface PackageRecord extends PackageFields {
  id: string
  code: string
  currency_code: string
  archived_at: Date | null
  created_at: Date
  limits: LimitValues
  /** Its platform flags as set; a flag left out takes the list's default (Ek C9). */
  features: Record<string, boolean>
}

/** A package's platform flags to set; null removes the package's value (the default applies). */
export type FeaturePatch = Record<string, boolean | null>

export interface FeatureOverrideRecord {
  id: string
  tenant_id: string
  key: string
  enabled: boolean
  reason: string
  expires_at: Date | null
  created_by: string | null
  created_at: Date
}

export const FEATURE_OVERRIDE_FIELDS = [
  "id",
  "tenant_id",
  "key",
  "enabled",
  "reason",
  "expires_at",
  "created_by",
  "created_at",
] as const

export interface OverrideRecord {
  id: string
  tenant_id: string
  key: LimitKey
  value: number | null
  reason: string
  expires_at: Date | null
  created_by: string | null
  created_at: Date
}

export const PACKAGE_FIELDS = [
  "id",
  "code",
  "name",
  "price",
  "currency_code",
  "period",
  "trial_days",
  "grace_days",
  "archived_at",
  "created_at",
] as const

export const OVERRIDE_FIELDS = [
  "id",
  "tenant_id",
  "key",
  "value",
  "reason",
  "expires_at",
  "created_by",
  "created_at",
] as const
