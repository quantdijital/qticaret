import { describe, expect, it } from "vitest"
import { SHELF_TABS, SHELF_TABS_DEFAULT, shelfJoins, shelfTabsOf } from "../store/section-shelf.js"

describe("a product rail's tabs setting (bilesen-denetimi (b) 2)", () => {
  it("joins its neighbours by default, as rails were drawn before the setting", () => {
    expect(SHELF_TABS).toEqual(["auto", "off"])
    expect(SHELF_TABS_DEFAULT).toBe("auto")
    expect(shelfTabsOf(undefined)).toBe("auto")
    expect(shelfTabsOf("on")).toBe("auto")
    expect(shelfTabsOf("off")).toBe("off")
  })

  it("keeps a columns rail and one set apart out of a tabbed shelf", () => {
    expect(shelfJoins({})).toBe(true)
    expect(shelfJoins({ variant: "carousel", tabs: "auto" })).toBe(true)
    expect(shelfJoins({ variant: "grid", tabs: "off" })).toBe(false)
    expect(shelfJoins({ variant: "columns" })).toBe(false)
  })
})
