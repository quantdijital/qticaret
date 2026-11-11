import type { Plan } from "@/features/packages/api"
import type { TenantDetail, TenantList } from "@/features/tenants/api"

const LIMITS = {
  products: 5000,
  orders_per_month: 10000,
  staff: 10,
  storage_mb: 20480,
  llm_credits_per_month: 2000,
  custom_domains: 3,
}

export const PRO: Plan = {
  id: "pkg_pro",
  code: "profesyonel",
  name: "Profesyonel",
  price: 149_000,
  currency_code: "TRY",
  period: "monthly",
  trial_days: 14,
  grace_days: 7,
  archived_at: null,
  created_at: "2026-11-01T09:00:00.000Z",
  limits: LIMITS,
  features: {},
  tenant_count: 2,
}

export const START: Plan = {
  ...PRO,
  id: "pkg_start",
  code: "baslangic",
  name: "Başlangıç",
  price: 49_000,
  limits: { ...LIMITS, products: 500, staff: 2 },
  tenant_count: 0,
}

export const OLD: Plan = {
  ...START,
  id: "pkg_old",
  code: "eski",
  name: "Esnaf",
  archived_at: "2026-11-05T09:00:00.000Z",
  tenant_count: 1,
}

export const LIST: TenantList = {
  tenants: [
    {
      id: "ten_mylarte",
      slug: "mylarte",
      name: "My L'arte",
      status: "active",
      status_changed_at: "2026-11-10T09:00:00.000Z",
      created_at: "2026-11-10T09:00:00.000Z",
      primary_hostname: "mylarte.localhost",
      package: { id: PRO.id, code: PRO.code, name: PRO.name },
      next_payment_on: null,
      health: { backend: "healthy", storefront: "failing" },
    },
    {
      id: "ten_kahve",
      slug: "kahveduragi",
      name: "Kahve Durağı",
      status: "provisioning",
      status_changed_at: "2026-11-11T09:00:00.000Z",
      created_at: "2026-11-11T09:00:00.000Z",
      primary_hostname: "kahveduragi.localhost",
      package: null,
      next_payment_on: null,
      health: { backend: null, storefront: null },
    },
  ],
  count: 2,
  counts: { provisioning: 1, active: 1, restricted: 0, suspended: 0, closing: 0, closed: 0 },
}

/** A sole proprietor's shop with one contact, its platform subdomain, a package and an exception. */
export const SHOP: TenantDetail = {
  tenant: {
    id: "ten_kahve",
    slug: "kahveduragi",
    name: "Kahve Durağı",
    status: "provisioning",
    status_changed_at: "2026-11-11T09:00:00.000Z",
    sector_pack: null,
    sector_pack_version: null,
    sector_pack_applied_at: null,
    created_at: "2026-11-11T09:00:00.000Z",
    created_by: "Deniz Kaya",
    next_payment_on: null,
  },
  company: {
    id: "tenco_1",
    kind: "sole_proprietor",
    legal_name: "Emre Şahin",
    tax_office: "Çankaya",
    tax_number: null,
    tckn_masked: "*******0146",
    address_line: "Kızılay Mah. Ziya Gökalp Cad. No: 18/3",
    district: "Çankaya",
    city: "Ankara",
    postal_code: "06420",
    country_code: "TR",
  },
  contacts: [
    {
      id: "tenct_1",
      name: "Emre Şahin",
      role: "owner",
      email: "emre@kahveduragi.com",
      phone: "+905051937420",
      is_primary_billing: true,
      created_at: "2026-11-11T09:00:00.000Z",
    },
  ],
  domains: [
    {
      id: "tendm_1",
      hostname: "kahveduragi.localhost",
      kind: "platform_subdomain",
      verification: "verified",
      is_primary: true,
      created_at: "2026-11-11T09:00:00.000Z",
    },
  ],
  notes: [
    {
      id: "tennt_1",
      body: "Kurulum için Salı günü aranacak.",
      pinned: true,
      author_id: "user_other",
      author: "Ece Demir",
      created_at: "2026-11-11T10:00:00.000Z",
      updated_at: "2026-11-11T10:00:00.000Z",
    },
  ],
  package: START,
  overrides: [
    {
      id: "tenov_1",
      key: "products",
      value: 2000,
      reason: "Toplu ürün aktarımı",
      expires_at: null,
      created_by: "Deniz Kaya",
      created_at: "2026-11-11T10:00:00.000Z",
    },
  ],
  limits: [
    { key: "products", package: 500, override: 2000, value: 2000 },
    { key: "orders_per_month", package: 10000, value: 10000 },
    { key: "staff", package: 2, value: 2 },
    { key: "storage_mb", package: 20480, value: 20480 },
    { key: "llm_credits_per_month", package: 2000, value: 2000 },
    { key: "custom_domains", package: 3, value: 3 },
  ],
  platform_flags: [{ key: "test.platform_sample", default: true }],
  features: [{ key: "test.platform_sample", default: true, package: false, value: false }],
  feature_overrides: [],
  plan_document: {
    issued: true,
    serial: 3,
    issued_at: "2026-11-11T10:05:00.000Z",
    push_status: "delivered",
    push_error: null,
    push_attempts: 1,
    pushed_at: "2026-11-11T10:05:01.000Z",
    pulled_at: null,
    push_target: null,
  },
}
