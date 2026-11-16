import { describe, expect, it } from "vitest"
import { itemFor } from "./navigation"

describe("itemFor: the menu item a page lights", () => {
  it.each([
    "/customers",
    "/customers/groups",
    "/customers/wholesale",
    "/customers/wholesale/tiers",
    "/customers/wholesale/tiers/wst_1",
    "/customers/wholesale/orders",
    "/customers/wholesale/wacc_1",
    "/customers/cus_1",
  ])("lights Müşteriler on %s, the wholesale screens too (ADR-0068)", (path) => {
    expect(itemFor(path)?.key).toBe("customers")
  })

  it("lights none on the alerts page, which belongs to the top bar's bell", () => {
    expect(itemFor("/notifications")).toBeUndefined()
  })
})
