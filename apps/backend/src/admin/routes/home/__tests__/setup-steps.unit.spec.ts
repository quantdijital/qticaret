import { DEFAULT_STORE_NAME, SETUP_STEPS, setupStatus } from "../setup-steps"
import type { SetupFacts } from "../setup-steps"
import tr from "../../../i18n/tr.json"

const READY: SetupFacts = {
  storeName: "Örnek Mağaza",
  hasDefaultCurrency: true,
  regionCount: 1,
  locationCount: 1,
  shippingOptionCount: 2,
  publishedProductCount: 5,
}

// A tenant right after bootstrap: TRY and the TR region, nothing else
const FRESH_TENANT: SetupFacts = {
  storeName: DEFAULT_STORE_NAME,
  hasDefaultCurrency: true,
  regionCount: 1,
  locationCount: 0,
  shippingOptionCount: 0,
  publishedProductCount: 0,
}

const doneKeys = (facts: SetupFacts) =>
  setupStatus(facts)
    .steps.filter((entry) => entry.isDone)
    .map((entry) => entry.step.key)

describe("home setup checklist", () => {
  it("is complete for a shop with everything in place", () => {
    expect(setupStatus(READY)).toMatchObject({ doneCount: SETUP_STEPS.length, nextKey: null })
  })

  it("offers naming the store first on a freshly bootstrapped tenant", () => {
    expect(doneKeys(FRESH_TENANT)).toEqual(["currency", "region"])
    expect(setupStatus(FRESH_TENANT).nextKey).toBe("storeName")
  })

  it("does not count Medusa's default or a blank name as named", () => {
    for (const storeName of [DEFAULT_STORE_NAME, ` ${DEFAULT_STORE_NAME} `, "", "   ", null]) {
      expect(doneKeys({ ...READY, storeName })).not.toContain("storeName")
    }
  })

  it("marks the first open step as next, in checklist order", () => {
    const status = setupStatus({ ...READY, locationCount: 0, publishedProductCount: 0 })
    expect(status.nextKey).toBe("location")
    expect(status.doneCount).toBe(SETUP_STEPS.length - 2)
  })

  it("has a title, description and button text for every step", () => {
    const steps = tr.qticaret.home.setup.steps as Record<string, Record<string, unknown>>
    for (const { key } of SETUP_STEPS) {
      expect(Object.keys(steps[key] ?? {}).sort()).toEqual(["action", "description", "title"])
    }
  })

  it("links every step to a dashboard screen", () => {
    for (const step of SETUP_STEPS) {
      expect(step.to).toMatch(/^\/(settings|products)\//)
    }
  })
})
