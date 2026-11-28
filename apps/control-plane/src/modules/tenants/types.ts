import type { TenantStatus } from "@qticaret/types/control-plane"
import type {
  CompanyKind,
  ContactRole,
  DomainCheckError,
  DomainKind,
  DomainVerification,
} from "../../lib/tenants/kinds"

export interface TenantRecord {
  id: string
  slug: string
  name: string
  status: TenantStatus
  status_changed_at: Date
  sector_pack: string | null
  /** C12: the pack's version the shop last applied, and when; null until it has. */
  sector_pack_version: number | null
  sector_pack_applied_at: Date | null
  /** adr/0063 task 2.7: the look it is set up with, and its version and when it was applied. */
  preset: string | null
  preset_version: number | null
  preset_applied_at: Date | null
  /** The owner's e-mail and phone handed to the shop as its storefront contact at setup. */
  storefront_contact: boolean
  created_by: string | null
  /** Internal base URL its plan document is pushed to (Ek C9); null: none. */
  api_base_url: string | null
  /** Its storefront's home page, probed for health (Ek C13); null: none known. */
  storefront_url: string | null
  created_at: Date
}

export interface CompanyFields {
  kind: CompanyKind
  legal_name: string | null
  tax_office: string | null
  tax_number: string | null
  tckn_sealed: string | null
  tckn_last4: string | null
  address_line: string | null
  district: string | null
  city: string | null
  postal_code: string | null
  country_code: string
}

export interface CompanyRecord extends CompanyFields {
  id: string
  tenant_id: string
}

export interface ContactFields {
  name: string
  role: ContactRole
  email: string
  phone: string | null
  is_primary_billing: boolean
}

export interface ContactRecord extends ContactFields {
  id: string
  tenant_id: string
  created_at: Date
}

export interface DomainRecord {
  id: string
  tenant_id: string
  hostname: string
  kind: DomainKind
  verification: DomainVerification
  is_primary: boolean
  verification_token: string | null
  verification_error: DomainCheckError | null
  verified_at: Date | null
  txt_lost_since: Date | null
  last_checked_at: Date | null
  next_check_at: Date | null
  check_attempts: number
  created_at: Date
}

export interface NoteRecord {
  id: string
  tenant_id: string
  body: string
  pinned: boolean
  author_id: string | null
  created_at: Date
  updated_at: Date
}

export const COMPANY_FIELDS = [
  "kind",
  "legal_name",
  "tax_office",
  "tax_number",
  "tckn_sealed",
  "tckn_last4",
  "address_line",
  "district",
  "city",
  "postal_code",
  "country_code",
] as const satisfies readonly (keyof CompanyFields)[]

export const CONTACT_FIELDS = [
  "id",
  "tenant_id",
  "name",
  "role",
  "email",
  "phone",
  "is_primary_billing",
  "created_at",
] as const

export const DOMAIN_FIELDS = [
  "id",
  "tenant_id",
  "hostname",
  "kind",
  "verification",
  "is_primary",
  "verification_token",
  "verification_error",
  "verified_at",
  "txt_lost_since",
  "last_checked_at",
  "next_check_at",
  "check_attempts",
  "created_at",
] as const

export const NOTE_FIELDS = [
  "id",
  "tenant_id",
  "body",
  "pinned",
  "author_id",
  "created_at",
  "updated_at",
] as const
