import { usageReportSchema } from "@qticaret/types/control-plane"
import { TENANT_ID } from "@qticaret/types/control-plane/testing"
import {
  buildUsageReport,
  megabytesOf,
  readUsageCounts,
  startOfTurkishMonth,
  turkishMonth,
} from "../usage"
import type { UsageCounts } from "../usage"

const release = { version: "1.4.0", commit: "0123456789abcdef0123456789abcdef01234567" }
const counts: UsageCounts = {
  products: 12,
  orders_this_month: 3,
  staff: 2,
  storage_mb: 5,
  llm_credits_this_month: 4,
  last_order_at: new Date("2026-11-10T08:00:00.000Z"),
}

describe("the usage report's months (Turkey, UTC+3)", () => {
  it("turns at midnight in Turkey, three hours before UTC", () => {
    expect(turkishMonth(new Date("2026-10-31T20:59:59.000Z"))).toBe("2026-10")
    expect(turkishMonth(new Date("2026-10-31T21:00:00.000Z"))).toBe("2026-11")
    expect(turkishMonth(new Date("2026-12-31T21:30:00.000Z"))).toBe("2027-01")
  })

  it("starts the month at 21:00 UTC of the day before", () => {
    expect(startOfTurkishMonth(new Date("2026-11-15T12:00:00.000Z")).toISOString()).toBe(
      "2026-10-31T21:00:00.000Z"
    )
    expect(startOfTurkishMonth(new Date("2026-10-31T21:00:00.000Z")).toISOString()).toBe(
      "2026-10-31T21:00:00.000Z"
    )
    expect(startOfTurkishMonth(new Date("2027-01-01T01:00:00.000Z")).toISOString()).toBe(
      "2026-12-31T21:00:00.000Z"
    )
  })

  it("counts a started megabyte as one", () => {
    expect([0, 1, 1024 * 1024, 1024 * 1024 + 1, -5].map(megabytesOf)).toEqual([0, 1, 1, 2, 0])
  })
})

describe("buildUsageReport", () => {
  it("holds exactly the contract's fields, checked strictly", () => {
    const now = new Date("2026-11-10T09:00:00.000Z")
    const report = buildUsageReport(TENANT_ID, counts, release, now)
    expect(usageReportSchema.parse(report)).toEqual(report)
    expect(Object.keys(report).sort()).toEqual(
      ["counts", "last_order_at", "period", "release", "reported_at", "tenant_id", "version"].sort()
    )
    expect(report).toEqual({
      version: 1,
      tenant_id: TENANT_ID,
      reported_at: "2026-11-10T09:00:00.000Z",
      period: "2026-11",
      counts: {
        products: 12,
        orders_this_month: 3,
        staff: 2,
        storage_mb: 5,
        llm_credits_this_month: 4,
      },
      last_order_at: "2026-11-10T08:00:00.000Z",
      release,
    })
  })

  it("carries no field the counts hold beyond the contract's, and refuses a bad count", () => {
    const extra = { ...counts, revenue: 99_000 } as UsageCounts
    const report = buildUsageReport(
      TENANT_ID,
      extra,
      { ...release, known: true } as never,
      new Date()
    )
    expect(JSON.stringify(report)).not.toContain("revenue")
    expect(JSON.stringify(report)).not.toContain("known")
    expect(() =>
      buildUsageReport(TENANT_ID, { ...counts, staff: -1 }, release, new Date())
    ).toThrow()
    expect(() =>
      buildUsageReport(TENANT_ID, counts, { version: "latest", commit: "x" }, new Date())
    ).toThrow()
  })
})

describe("buildUsageReport's setup (Ek C21)", () => {
  const setup = {
    store_named: true,
    currency: true,
    region: true,
    stock_location: true,
    shipping: true,
    payment: false,
    product_published: true,
    look_published: false,
    legal_published: false,
    mail_sender: false,
  }

  it("adds the checklist when given, and leaves the field out when not", () => {
    const now = new Date("2026-11-10T09:00:00.000Z")
    expect(buildUsageReport(TENANT_ID, counts, release, now, setup).setup).toEqual(setup)
    expect(buildUsageReport(TENANT_ID, counts, release, now, null)).not.toHaveProperty("setup")
  })

  it("refuses a checklist carrying more than yes and no", () => {
    const now = new Date()
    expect(() =>
      buildUsageReport(TENANT_ID, counts, release, now, { ...setup, payment: "paytr" } as never)
    ).toThrow()
    expect(() =>
      buildUsageReport(TENANT_ID, counts, release, now, { ...setup, owner: "x" } as never)
    ).toThrow()
  })
})

describe("readUsageCounts", () => {
  it("reads one row's count each, orders of this Turkish month without drafts", async () => {
    const graphs: { filters: Record<string, unknown>; pagination: unknown }[] = []
    const services: Record<string, unknown> = {
      query: {
        graph: (input: { filters: Record<string, unknown>; pagination: unknown }) => {
          graphs.push(input)
          return Promise.resolve(
            "created_at" in input.filters
              ? { data: [{ id: "order_1" }], metadata: { count: 7 } }
              : { data: [{ created_at: "2026-11-09T10:00:00.000Z" }], metadata: { count: 40 } }
          )
        },
      },
      product: { listAndCountProducts: () => Promise.resolve([[{ id: "p" }], 31]) },
      user: { listAndCountUsers: () => Promise.resolve([[{ id: "u" }], 4]) },
      media: { storedBytes: () => Promise.resolve(3 * 1024 * 1024 + 10) },
      content_drafts: {
        usedIn: (month: string) => Promise.resolve(month === "2026-11" ? 6 : 0),
      },
    }
    const container = { resolve: (key: string) => services[key] } as never
    const now = new Date("2026-11-10T09:00:00.000Z")

    expect(await readUsageCounts(container, now)).toEqual({
      products: 31,
      orders_this_month: 7,
      staff: 4,
      storage_mb: 4,
      llm_credits_this_month: 6,
      last_order_at: new Date("2026-11-09T10:00:00.000Z"),
    })
    const [month, last] = graphs
    expect(month?.filters).toEqual({
      status: { $nin: ["draft", "archived"] },
      is_draft_order: false,
      created_at: { $gte: new Date("2026-10-31T21:00:00.000Z") },
    })
    expect(month?.pagination).toEqual({ skip: 0, take: 1 })
    expect(last?.pagination).toEqual({ skip: 0, take: 1, order: { created_at: "DESC" } })
  })
})
