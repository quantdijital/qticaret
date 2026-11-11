import type { PlanLimits } from "@qticaret/types/control-plane"
import { DEFAULT_PLAN_STATE, NO_LIMITS } from "../../../modules/control-plane/types"
import { isPlanLimitError } from "../../errors"
import {
  assertProductsWithinLimit,
  assertStaffSeat,
  assertStorageFits,
  blockingLimit,
  draftQuotaOf,
  productAllowance,
} from "../check"
import { forgetUsage } from "../usage"

const MB = 1024 * 1024

interface Counts {
  products?: number
  users?: number
  invites?: number
  bytes?: number
  drafts?: number
}

/** A shop as the checks see it: the plan document's limits and its counters. */
function shop(managed: boolean, limits: Partial<PlanLimits>, counts: Counts = {}) {
  const state = { ...DEFAULT_PLAN_STATE(managed), limits: { ...NO_LIMITS, ...limits } }
  const services: Record<string, unknown> = {
    control_plane: { planState: () => Promise.resolve(state) },
    product: { listAndCountProducts: () => Promise.resolve([[], counts.products ?? 0]) },
    user: {
      listAndCountUsers: () => Promise.resolve([[], counts.users ?? 0]),
      listAndCountInvites: () => Promise.resolve([[], counts.invites ?? 0]),
    },
    media: { storedBytes: () => Promise.resolve(counts.bytes ?? 0) },
    content_drafts: { usedIn: () => Promise.resolve(counts.drafts ?? 0) },
  }
  return { resolve: (key: string) => services[key] } as never
}

/** The refusal a check threw, as the HTTP layer reads it; null when it let the write go. */
async function refusal(check: Promise<unknown>) {
  try {
    await check
    return null
  } catch (error) {
    if (!isPlanLimitError(error)) {
      throw error
    }
    return { limit: error.limit, used: error.used, max: error.max }
  }
}

beforeEach(() => {
  forgetUsage()
})

describe("plan limits (adr/0061 Ek C14)", () => {
  it("holds nothing back in an unmanaged shop, whatever the counts", async () => {
    const unmanaged = shop(
      false,
      { products: 1, staff: 1, storage_mb: 1 },
      {
        products: 50,
        users: 9,
        bytes: 90 * MB,
      }
    )
    expect(await refusal(assertProductsWithinLimit(unmanaged, 3))).toBeNull()
    expect(await refusal(assertStaffSeat(unmanaged))).toBeNull()
    expect(await refusal(assertStorageFits(unmanaged, 5 * MB))).toBeNull()
    expect(await productAllowance(unmanaged)).toBeNull()
    expect(await draftQuotaOf(unmanaged, 200)).toEqual({ quota: 200, plan: null })
  })

  it("applies only the blocking limits: orders warn, custom domains wait", async () => {
    const managed = shop(true, { orders_per_month: 1, custom_domains: 0, products: 5 })
    expect(await blockingLimit(managed, "orders_per_month")).toBeNull()
    expect(await blockingLimit(managed, "custom_domains")).toBeNull()
    expect(await blockingLimit(managed, "products")).toBe(5)
  })

  it("refuses new products that take the count past the limit, counted after the write", async () => {
    // 5 allowed; the write that made the fifth passes, the one that made a sixth does not
    expect(
      await refusal(assertProductsWithinLimit(shop(true, { products: 5 }, { products: 5 }), 1))
    ).toBeNull()
    expect(
      await refusal(assertProductsWithinLimit(shop(true, { products: 5 }, { products: 7 }), 2))
    ).toEqual({ limit: "products", used: 5, max: 5 })
    // A package of none: the first product is refused
    expect(
      await refusal(assertProductsWithinLimit(shop(true, { products: 0 }, { products: 1 }), 1))
    ).toEqual({ limit: "products", used: 0, max: 0 })
    // No limit in the package
    expect(
      await refusal(assertProductsWithinLimit(shop(true, {}, { products: 900 }), 1))
    ).toBeNull()
  })

  it("tells an import how many new products still fit", async () => {
    expect(await productAllowance(shop(true, { products: 10 }, { products: 7 }))).toBe(3)
    // Already past (a lowered package): none, never negative; what is there stays
    expect(await productAllowance(shop(true, { products: 10 }, { products: 12 }))).toBe(0)
  })

  it("counts open invitations as seats", async () => {
    expect(
      await refusal(assertStaffSeat(shop(true, { staff: 3 }, { users: 1, invites: 1 })))
    ).toBeNull()
    expect(
      await refusal(assertStaffSeat(shop(true, { staff: 3 }, { users: 2, invites: 1 })))
    ).toEqual({
      limit: "staff",
      used: 3,
      max: 3,
    })
  })

  it("holds an upload to the megabytes it would bring, a fetch to a library not yet full", async () => {
    const half = shop(true, { storage_mb: 10 }, { bytes: 9 * MB })
    expect(await refusal(assertStorageFits(half, MB))).toBeNull()
    expect(await refusal(assertStorageFits(half, MB + 1))).toEqual({
      limit: "storage_mb",
      used: 9,
      max: 10,
    })
    // An outside image's size is unknown: allowed while below the limit
    expect(await refusal(assertStorageFits(half, 0))).toBeNull()
    expect(
      await refusal(assertStorageFits(shop(true, { storage_mb: 10 }, { bytes: 10 * MB }), 0))
    ).toEqual({ limit: "storage_mb", used: 10, max: 10 })
  })

  it("gives drafts the lower of the platform's quota and the package's credits", async () => {
    expect(await draftQuotaOf(shop(true, { llm_credits_per_month: 20 }), 200)).toEqual({
      quota: 20,
      plan: 20,
    })
    expect(await draftQuotaOf(shop(true, { llm_credits_per_month: 500 }), 200)).toEqual({
      quota: 200,
      plan: null,
    })
    expect(await draftQuotaOf(shop(true, {}), 200)).toEqual({ quota: 200, plan: null })
  })
})
