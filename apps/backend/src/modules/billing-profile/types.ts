import type { TaxIdKind } from "@qticaret/server-kit"
import { maskTaxId } from "@qticaret/server-kit"

export const BILLING_PROFILE_TYPES = ["individual", "corporate"] as const
export type BillingProfileType = (typeof BILLING_PROFILE_TYPES)[number]

/** What a customer submits; `tax_id` is plaintext and must not be logged. */
export interface BillingProfileInput {
  type: BillingProfileType
  legal_name: string
  tax_office?: string | null
  tax_id: string
}

export interface BillingProfileModuleOptions {
  /** 64 hex characters (PII_ENCRYPTION_KEY). */
  encryptionKey: string
  /** 64 hex characters (PII_HASH_KEY). */
  hashKey: string
}

/** The only shape that leaves the backend: tax id masked. */
export interface MaskedBillingProfile {
  id: string
  type: BillingProfileType
  legal_name: string
  tax_office: string | null
  tax_id_kind: TaxIdKind
  tax_id_masked: string
}

export interface StoredBillingProfile {
  id: string
  type: BillingProfileType
  legal_name: string
  tax_office: string | null
  tax_id_kind: TaxIdKind
  tax_id_last4: string
}

export function toMaskedBillingProfile(profile: StoredBillingProfile): MaskedBillingProfile {
  return {
    id: profile.id,
    type: profile.type,
    legal_name: profile.legal_name,
    tax_office: profile.tax_office,
    tax_id_kind: profile.tax_id_kind,
    tax_id_masked: maskTaxId(profile.tax_id_kind, profile.tax_id_last4),
  }
}

/** Fields a masked view needs; never select the encrypted value or hash for display. */
export const MASKED_PROFILE_FIELDS = [
  "id",
  "type",
  "legal_name",
  "tax_office",
  "tax_id_kind",
  "tax_id_last4",
] as const
