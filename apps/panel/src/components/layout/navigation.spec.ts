import { describe, expect, it } from "vitest"
import { NAV_GROUPS, itemFor, navItem } from "./navigation"

describe("itemFor: the menu item a page lights", () => {
  it.each(["/customers", "/customers/groups", "/customers/abandoned-carts", "/customers/cus_1"])(
    "lights Müşteriler on %s",
    (path) => {
      expect(itemFor(path)?.key).toBe("customers")
    }
  )

  it.each([
    "/wholesale",
    "/wholesale/tiers",
    "/wholesale/tiers/wst_1",
    "/wholesale/orders",
    "/wholesale/wacc_1",
  ])("lights Toptancılar, not Müşteriler, on %s (the owner, 2026-11-16)", (path) => {
    expect(itemFor(path)?.key).toBe("wholesale")
  })

  it("lights none on the alerts page, which belongs to the top bar's bell", () => {
    expect(itemFor("/notifications")).toBeUndefined()
  })
})

describe("the Sayfalar item (adr/0073 Ek not 2026-11-20)", () => {
  it("stands in Vitrin before the blog, lit on its list", () => {
    expect(navItem("pages")).toMatchObject({ to: "/storefront/pages" })
    expect(itemFor("/storefront/pages")?.key).toBe("pages")
    expect(itemFor("/content")?.key).toBe("content")
    const storefront = NAV_GROUPS.find((group) => group.key === "storefront")
    const keys = storefront?.items.map((item) => item.key) ?? []
    expect(keys.indexOf("pages")).toBeLessThan(keys.indexOf("content"))
  })
})

describe("the Toptancılar item", () => {
  it("sits behind the wholesale flag and the wholesale capability (ADR-0068 §9)", () => {
    expect(navItem("wholesale")).toMatchObject({
      to: "/wholesale",
      feature: "customers.wholesale",
      needs: "wholesale",
    })
  })
})
