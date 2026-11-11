import { createHash } from "node:crypto"
import type { PlanDocument } from "./plan-document"
import type { UsageReport } from "./usage-report"

// Test-only fixtures of the contract (adr/0061 Ek C2, C9): the vectors both
// apps check their wire format against. Loading this file anywhere but a
// test is refused
if (process.env["NODE_ENV"] !== "test") {
  throw new Error("@qticaret/types/control-plane/testing is for tests only")
}

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

/** `planDocument` signed with `TEST_ONLY_CP_SEED` (vectors.test.ts fixes these). */
export const PLAN_VECTOR = {
  kid: "8ef1b5e037c46d50",
  signature:
    "4bFsaf_yZv4DHBIguglbltruHb3xpdf4yX_Bnz-bMAv1x3igKusDQs_ifOG7Sx8vsZZ1uHoMh9mOSyqld92VDg",
} as const
