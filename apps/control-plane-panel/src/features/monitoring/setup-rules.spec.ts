import { describe, expect, it } from "vitest"
import { setupProgress } from "./setup-rules"

const ALL_DONE = {
  store_named: true,
  currency: true,
  region: true,
  stock_location: true,
  shipping: true,
  payment: true,
  product_published: true,
  look_published: true,
  legal_published: true,
  mail_sender: true,
}

describe("setupProgress (Ek C21)", () => {
  it("is null when the shop sent no checklist", () => {
    expect(setupProgress(null)).toBeNull()
    expect(setupProgress(undefined)).toBeNull()
  })

  it("counts the steps done and names the missing ones in the checklist's order", () => {
    const progress = setupProgress({ ...ALL_DONE, shipping: false, payment: false })
    expect(progress).toMatchObject({ done: 8, total: 10, complete: false })
    expect(progress?.missing).toEqual(["shipping", "payment"])
    expect(progress?.steps[0]).toEqual({ key: "store_named", done: true })
  })

  it("is complete when every step is done", () => {
    expect(setupProgress(ALL_DONE)).toMatchObject({
      done: 10,
      total: 10,
      missing: [],
      complete: true,
    })
  })
})
