import { createHash } from "node:crypto"
import type { PlanDocument } from "../../control-plane/plan-document.js"
import type { UsageReport } from "../../control-plane/usage-report.js"

/**
 * TEST-ONLY keys: each seed is the SHA-256 of a public phrase, so anyone can
 * derive them. Never use them outside tests; no environment holds them.
 */
export const TEST_ONLY_CP_SEED = createHash("sha256")
  .update("qticaret:test-only:control-plane-signing-key")
  .digest()
export const TEST_ONLY_TENANT_SEED = createHash("sha256")
  .update("qticaret:test-only:tenant-signing-key")
  .digest()

/** 2026-11-10T09:00:00Z, the vectors' fixed clock. */
export const FIXED_NOW = Date.UTC(2026, 10, 10, 9, 0, 0)
export const FIXED_NONCE = "AAECAwQFBgcICQoLDA0ODw"
export const TENANT_ID = "ten_01JCP0TEST0000000000000000"

export const planDocument: PlanDocument = {
  version: 1,
  tenant_id: TENANT_ID,
  serial: 7,
  issued_at: "2026-11-10T09:00:00.000Z",
  status: "active",
  package_code: "standart",
  limits: {
    products: 500,
    orders_per_month: null,
    staff: 3,
    storage_mb: 2048,
    llm_credits_per_month: 100,
    custom_domains: 1,
  },
  platform_flags: { "test.platform_sample": true },
  billing: {
    status: "active",
    due_on: "2026-12-01",
    grace_ends_on: null,
    amount: 149900,
    currency: "TRY",
  },
}

export const usageReport: UsageReport = {
  version: 1,
  tenant_id: TENANT_ID,
  reported_at: "2026-11-10T09:00:00.000Z",
  period: "2026-11",
  counts: {
    products: 120,
    orders_this_month: 42,
    staff: 2,
    storage_mb: 380,
    llm_credits_this_month: 7,
  },
  last_order_at: "2026-11-10T08:41:12.000Z",
  release: { version: "0.17.0", commit: "8a128bbe" },
}
