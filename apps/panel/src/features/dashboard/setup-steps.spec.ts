import { describe, expect, it } from "vitest"
import { DEFAULT_STORE_NAME, setupStatus } from "./setup-steps"
import type { SetupFacts } from "./setup-steps"

const READY: SetupFacts = {
  storeName: "Bıçak Dünyası",
  hasDefaultCurrency: true,
  regionCount: 1,
  locationCount: 1,
  shippingOptionCount: 1,
  publishedProductCount: 3,
}

describe("setupStatus", () => {
  it("is done once every step is", () => {
    const status = setupStatus(READY)

    expect(status.doneCount).toBe(6)
    expect(status.nextKey).toBeNull()
  })

  it("offers the first open step as next, in setup order", () => {
    expect(setupStatus({ ...READY, locationCount: 0, shippingOptionCount: 0 }).nextKey).toBe(
      "location"
    )
    expect(setupStatus({ ...READY, regionCount: 0, publishedProductCount: 0 }).nextKey).toBe(
      "region"
    )
  })

  it("does not count Medusa's default store name, or a blank one, as a name", () => {
    expect(setupStatus({ ...READY, storeName: DEFAULT_STORE_NAME }).nextKey).toBe("storeName")
    expect(setupStatus({ ...READY, storeName: "  " }).nextKey).toBe("storeName")
    expect(setupStatus({ ...READY, storeName: null }).nextKey).toBe("storeName")
  })
})
