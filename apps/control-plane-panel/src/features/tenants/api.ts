import { keepPreviousData, queryOptions } from "@tanstack/react-query"
import type { LimitKey, TenantStatus } from "@qticaret/types/control-plane"
import type { Plan } from "@/features/packages/api"
import { api } from "@/lib/api"

/**
 * The shops (adr/0061 §2, C7) as the control plane answers them. The list
 * holds no personal data; a shop's page does (its contacts), and reading it
 * is recorded.
 */

export type CompanyKind = "company" | "sole_proprietor"
export type ContactRole = "owner" | "billing" | "technical"

export interface TenantRow {
  id: string
  slug: string
  name: string
  status: TenantStatus
  status_changed_at: string
  created_at: string
  primary_hostname: string | null
  package: { id: string; code: string; name: string } | null
  /** The subscription's next due date: billing (C16). */
  next_payment_on: string | null
}

export interface TenantList {
  tenants: TenantRow[]
  count: number
  counts: Record<TenantStatus, number>
}

export interface Company {
  id: string
  kind: CompanyKind
  legal_name: string | null
  tax_office: string | null
  tax_number: string | null
  /** `*******1234`: the TCKN is never in an answer but the reveal's. */
  tckn_masked: string | null
  address_line: string | null
  district: string | null
  city: string | null
  postal_code: string | null
  country_code: string
}

export interface Contact {
  id: string
  name: string
  role: ContactRole
  email: string
  /** E.164. */
  phone: string | null
  is_primary_billing: boolean
  created_at: string
}

export interface Domain {
  id: string
  hostname: string
  kind: "platform_subdomain" | "custom"
  verification: "pending" | "verified" | "failed"
  is_primary: boolean
  created_at: string
}

export interface Note {
  id: string
  body: string
  pinned: boolean
  author_id: string | null
  author: string | null
  created_at: string
  updated_at: string
}

export interface Override {
  id: string
  key: LimitKey
  value: number | null
  reason: string
  expires_at: string | null
  created_by: string | null
  created_at: string
}

export interface EffectiveLimit {
  key: LimitKey
  /** Absent when the shop has no package. */
  package?: number | null
  /** Absent when no exception holds. */
  override?: number | null
  value: number | null
}

/** A platform flag as the shop's plan document carries it (adr/0061 Ek C9). */
export interface EffectiveFlag {
  key: string
  default: boolean
  /** Absent when the package sets none (or there is no package). */
  package?: boolean
  /** Absent when no exception holds. */
  override?: boolean
  value: boolean
}

export interface FeatureOverride {
  id: string
  key: string
  enabled: boolean
  reason: string
  expires_at: string | null
  created_by: string | null
  created_at: string
}

/** What the shop was last told and whether it took it; owner and operator only. */
export interface PlanDocumentState {
  issued: boolean
  serial?: number
  issued_at?: string
  push_status?: "pending" | "delivered" | "failed" | "superseded"
  push_error?: string | null
  push_attempts?: number
  pushed_at?: string | null
  pulled_at?: string | null
  push_target: string | null
}

export interface TenantDetail {
  tenant: {
    id: string
    slug: string
    name: string
    status: TenantStatus
    status_changed_at: string
    sector_pack: string | null
    /** C12: the pack's version the shop last applied, and when; null until it has. */
    sector_pack_version: number | null
    sector_pack_applied_at: string | null
    created_at: string
    created_by: string | null
    next_payment_on: string | null
  }
  company: Company | null
  contacts: Contact[]
  domains: Domain[]
  notes: Note[]
  package: Plan | null
  overrides: Override[]
  limits: EffectiveLimit[]
  platform_flags: { key: string; default: boolean }[]
  features: EffectiveFlag[]
  feature_overrides: FeatureOverride[]
  plan_document?: PlanDocumentState
}

export interface ActivityItem {
  id: string
  kind: "status" | "action"
  at: string
  actor: string | null
  action?: string
  changes?: Record<string, unknown> | null
  from_status?: TenantStatus | null
  to_status?: TenantStatus
  reason_code?: string
}

export interface TenantFilters {
  status: TenantStatus | "all"
  q: string
  /** Zero-based. */
  page: number
}

export const TENANTS_PAGE_SIZE = 20
export const TENANTS_KEY = ["tenants"] as const

export const tenantsQuery = ({ status, q, page }: TenantFilters) =>
  queryOptions({
    queryKey: [...TENANTS_KEY, "list", status, q, page],
    queryFn: () =>
      api<TenantList>("/admin/cp/tenants", {
        query: {
          status: status === "all" ? undefined : status,
          q: q.trim() || undefined,
          limit: TENANTS_PAGE_SIZE,
          offset: page * TENANTS_PAGE_SIZE,
        },
      }),
    placeholderData: keepPreviousData,
  })

export const tenantPath = (id: string, rest = "") =>
  `/admin/cp/tenants/${encodeURIComponent(id)}${rest}`

export const tenantKey = (id: string) => [...TENANTS_KEY, "detail", id] as const

/** A shop in full (all staff); the read is recorded. */
export const tenantQuery = (id: string) =>
  queryOptions({
    queryKey: tenantKey(id),
    queryFn: () => api<TenantDetail>(tenantPath(id)),
  })

export const ACTIVITY_PAGE_SIZE = 30

/** A page of the shop's activity, newest first, before a moment (none: the newest). */
export const fetchActivity = (id: string, before: string | null) =>
  api<{ items: ActivityItem[]; next_before: string | null }>(tenantPath(id, "/activity"), {
    query: { limit: ACTIVITY_PAGE_SIZE, before: before ?? undefined },
  })
