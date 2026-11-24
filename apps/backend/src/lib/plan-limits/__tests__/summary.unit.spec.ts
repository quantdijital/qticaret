import { RESTRICTED_UNTRUSTED } from "../../../modules/control-plane/trusted-state"
import { DEFAULT_PLAN_STATE, NO_LIMITS } from "../../../modules/control-plane/types"
import { readPlanSummary } from "../summary"
import { USAGE_CACHE_MS, forgetUsage } from "../usage"

const MB = 1024 * 1024

function shop(managed: boolean) {
  const counts = { products: 41 }
  const state = {
    ...DEFAULT_PLAN_STATE(managed),
    // A verified document has a serial; managed without one there is none to trust
    serial: managed ? 7 : null,
    package_code: managed ? "standart" : null,
    limits: { ...NO_LIMITS, products: 50, orders_per_month: 10, staff: 3, storage_mb: 100 },
    billing: managed
      ? {
          status: "active" as const,
          due_on: null,
          grace_ends_on: null,
          amount: null,
          currency: "TRY" as const,
        }
      : null,
  }
  const services: Record<string, unknown> = {
    control_plane: { planState: () => Promise.resolve(state) },
    product: { listAndCountProducts: () => Promise.resolve([[], counts.products]) },
    user: {
      listAndCountUsers: () => Promise.resolve([[], 2]),
      listAndCountInvites: () => Promise.resolve([[], 1]),
    },
    media: { storedBytes: () => Promise.resolve(80 * MB + 1) },
    content_drafts: { usedIn: () => Promise.resolve(4) },
    query: { graph: () => Promise.resolve({ data: [], metadata: { count: 12 } }) },
  }
  return { container: { resolve: (key: string) => services[key] } as never, counts }
}

beforeEach(() => {
  forgetUsage()
})

describe("readPlanSummary (Settings > Abonelik, adr/0061 Ek C14)", () => {
  it("gives each limit its kind, use and allowance; seats count open invitations", async () => {
    const now = new Date("2026-11-15T09:00:00.000Z")
    const summary = await readPlanSummary(shop(true).container, now)

    expect(summary).toMatchObject({
      managed: true,
      status: "active",
      package_code: "standart",
      period: "2026-11",
      warning_ratio: 0.8,
      payment_instruction: null,
      billing: { status: "active", amount: null },
    })
    expect(summary.limits).toEqual([
      { key: "products", kind: "block", unit: "count", monthly: false, used: 41, max: 50 },
      { key: "orders_per_month", kind: "warn", unit: "count", monthly: true, used: 12, max: 10 },
      { key: "staff", kind: "block", unit: "count", monthly: false, used: 3, max: 3, pending: 1 },
      { key: "storage_mb", kind: "block", unit: "mb", monthly: false, used: 81, max: 100 },
      {
        key: "llm_credits_per_month",
        kind: "block",
        unit: "count",
        monthly: true,
        used: 4,
        max: null,
      },
      {
        key: "custom_domains",
        kind: "later",
        unit: "count",
        monthly: false,
        used: null,
        max: null,
      },
    ])
  })

  it("lifts the package's name and the payment instruction out of the signed billing (Ek C16)", async () => {
    const { container } = shop(true)
    const services = container as unknown as { resolve: (key: string) => unknown }
    const state = await (
      services.resolve("control_plane") as { planState: () => Promise<Record<string, unknown>> }
    ).planState()
    state["billing"] = {
      status: "past_due",
      due_on: "2026-12-01",
      grace_ends_on: "2026-12-08",
      amount: 149_000,
      currency: "TRY",
      package_name: "Profesyonel Ağ",
      payment_instruction: "IBAN: TR12",
    }

    const summary = await readPlanSummary(container)

    expect(summary).toMatchObject({
      package_name: "Profesyonel Ağ",
      payment_instruction: "IBAN: TR12",
    })
    // A document without the terms (an older control plane): each one null
    expect(summary.billing).toEqual({
      status: "past_due",
      due_on: "2026-12-01",
      grace_ends_on: "2026-12-08",
      amount: 149_000,
      currency: "TRY",
      period: null,
      price: null,
      trial_started_on: null,
      trial_ends_on: null,
    })
  })

  it("passes the subscription's terms through: period, price and trial (Ek C20)", async () => {
    const { container } = shop(true)
    const services = container as unknown as { resolve: (key: string) => unknown }
    const state = await (
      services.resolve("control_plane") as { planState: () => Promise<Record<string, unknown>> }
    ).planState()
    state["billing"] = {
      status: "trialing",
      due_on: "2026-11-15",
      grace_ends_on: null,
      amount: 149_000,
      currency: "TRY",
      period: "yearly",
      price: 1_490_000,
      trial_started_on: "2026-11-01",
      trial_ends_on: "2026-11-15",
    }

    const summary = await readPlanSummary(container)

    expect(summary.billing).toMatchObject({
      status: "trialing",
      period: "yearly",
      price: 1_490_000,
      trial_started_on: "2026-11-01",
      trial_ends_on: "2026-11-15",
    })
    // The month the limits count stays the summary's own
    expect(summary.period).toMatch(/^\d{4}-\d{2}$/)
  })

  it("lists the package's features as the signed flags set them, test-only ones left out", async () => {
    const { container } = shop(true)
    const services = container as unknown as { resolve: (key: string) => unknown }
    const state = await (
      services.resolve("control_plane") as { planState: () => Promise<Record<string, unknown>> }
    ).planState()
    state["platform_flags"] = { "catalog.product_videos": false, "test.platform_sample": false }

    const summary = await readPlanSummary(container)

    // A flag the document does not name takes its default (on)
    expect(summary.features).toEqual([
      { key: "catalog.product_videos", enabled: false },
      { key: "ai.own_keys", enabled: true },
    ])
  })

  it("lists no features from a stored document it does not trust", async () => {
    const { container } = shop(true)
    const services = container as unknown as { resolve: (key: string) => unknown }
    const state = await (
      services.resolve("control_plane") as { planState: () => Promise<Record<string, unknown>> }
    ).planState()
    // A row that failed its checks: managed, no package, no flags; each flag's
    // default ("on") may not be what the last applied document set
    Object.assign(state, RESTRICTED_UNTRUSTED("suspended"))

    const summary = await readPlanSummary(container)

    expect(summary).toMatchObject({ managed: true, status: "suspended", features: [] })
  })

  it("lists no features before the first document arrives", async () => {
    const { container } = shop(true)
    const services = container as unknown as { resolve: (key: string) => unknown }
    const state = await (
      services.resolve("control_plane") as { planState: () => Promise<Record<string, unknown>> }
    ).planState()
    state["serial"] = null

    expect((await readPlanSummary(container)).features).toEqual([])
  })

  it("gives every feature its default without a control plane", async () => {
    const summary = await readPlanSummary(shop(false).container)
    expect(summary.features.every((feature) => feature.enabled)).toBe(true)
    expect(summary.features.map((feature) => feature.key)).not.toContain("test.platform_sample")
  })

  it("has no limits and no billing without a control plane", async () => {
    const summary = await readPlanSummary(shop(false).container)
    expect(summary.managed).toBe(false)
    expect(summary.billing).toBeNull()
    expect(summary).toMatchObject({ package_name: null, payment_instruction: null })
    expect(summary.limits.every((limit) => limit.max === null)).toBe(true)
  })

  it("keeps a count for a few seconds, then counts again", async () => {
    const { container, counts } = shop(true)
    const now = new Date("2026-11-15T09:00:00.000Z")
    const first = await readPlanSummary(container, now)
    counts.products = 45
    const soon = await readPlanSummary(container, new Date(now.getTime() + 1000))
    const later = await readPlanSummary(container, new Date(now.getTime() + USAGE_CACHE_MS))

    expect(first.limits[0]?.used).toBe(41)
    expect(soon.limits[0]?.used).toBe(41)
    expect(later.limits[0]?.used).toBe(45)
  })
})
