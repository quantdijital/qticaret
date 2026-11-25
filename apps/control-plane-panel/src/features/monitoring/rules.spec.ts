import { describe, expect, it } from "vitest"
import type { EffectiveLimit } from "@/features/tenants/api"
import { toneOf, uptimeOf, usageRows, wordOf, worstOf } from "./rules"

const limits: EffectiveLimit[] = [
  { key: "products", value: 500 },
  { key: "orders_per_month", value: 100 },
  { key: "staff", value: 2 },
  { key: "storage_mb", value: null },
  { key: "llm_credits_per_month", value: 0 },
  { key: "custom_domains", value: 1 },
  // A grant (adr/0085 K5): nothing to count, no row
  { key: "ai_free_credits_per_month", value: 300 },
]
const counts = {
  products: 399,
  orders_this_month: 140,
  staff: 2,
  storage_mb: 900,
  llm_credits_this_month: 0,
}

describe("usage against limits (Ek C13)", () => {
  it("warns from 80 %, is full at a blocking limit, only warns past the orders' one", () => {
    expect(toneOf("products", 399, 500)).toBe("ok")
    expect(toneOf("products", 400, 500)).toBe("warn")
    expect(toneOf("products", 500, 500)).toBe("full")
    expect(toneOf("orders_per_month", 80, 100)).toBe("warn")
    expect(toneOf("orders_per_month", 140, 100)).toBe("over")
    expect(toneOf("custom_domains", 2, 1)).toBe("over")
    expect(toneOf("storage_mb", 1_000_000, null)).toBe("ok")
  })

  it("pairs each limit with its count; the domains come from the record", () => {
    expect(usageRows(limits, counts, 1)).toEqual([
      { key: "products", used: 399, limit: 500, ratio: 0.798, tone: "ok" },
      { key: "orders_per_month", used: 140, limit: 100, ratio: 1, tone: "over" },
      { key: "staff", used: 2, limit: 2, ratio: 1, tone: "full" },
      { key: "storage_mb", used: 900, limit: null, ratio: null, tone: "ok" },
      { key: "llm_credits_per_month", used: 0, limit: 0, ratio: 1, tone: "full" },
      { key: "custom_domains", used: 1, limit: 1, ratio: 1, tone: "over" },
    ])
    // No report yet: no count but the record's
    expect(usageRows(limits, null, 0).map((row) => row.used)).toEqual([
      null,
      null,
      null,
      null,
      null,
      0,
    ])
  })
})

describe("health words (Ek C13)", () => {
  const target = { probed: true, standing: null, history: [], day: { total: 0, ok: 0 } }

  it("names a target never probed, one without an address, and the worse of two", () => {
    expect(wordOf(target)).toBe("unknown")
    expect(wordOf({ ...target, probed: false })).toBe("off")
    expect(worstOf(["healthy", "failing"])).toBe("failing")
    expect(worstOf([null, "unhealthy"])).toBe("unhealthy")
    expect(worstOf([null, null])).toBeNull()
    expect(uptimeOf({ total: 0, ok: 0 })).toBeNull()
    expect(uptimeOf({ total: 4, ok: 3 })).toBe(0.75)
  })
})
