import { afterEach, describe, expect, it } from "vitest"
import { DEFAULT_VIEW, parseView, readView, toggleView, viewOff } from "./view-prefs"

describe("the product page's own view", () => {
  afterEach(() => {
    window.localStorage.clear()
  })

  it("keeps only the parts the page knows and may hide, a part once", () => {
    expect(
      parseView({ hidden: ["faq", "nope", "general", "stock"], shown: ["stock", "catalog"] })
    ).toEqual({ hidden: ["faq", "stock"], shown: ["catalog"] })
    expect(parseView({ hidden: "faq" })).toEqual(DEFAULT_VIEW)
    expect(parseView(null)).toEqual(DEFAULT_VIEW)
  })

  it("is read per person, the defaults when nothing or nonsense is stored", () => {
    window.localStorage.setItem(
      "qt.panel.products.view.v1:user_a",
      JSON.stringify({ hidden: ["faq"], shown: [] })
    )
    window.localStorage.setItem("qt.panel.products.view.v1:user_c", "{not json")

    expect(readView("user_a")).toEqual({ hidden: ["faq"], shown: [] })
    expect(readView("user_b")).toEqual(DEFAULT_VIEW)
    expect(readView("user_c")).toEqual(DEFAULT_VIEW)
  })

  it("hides a part for the person and brings it back", () => {
    const off = toggleView(DEFAULT_VIEW, "faq", false)
    expect(off).toEqual({ hidden: ["faq"], shown: [] })
    expect(viewOff(off, "faq", false)).toBe(true)
    expect(toggleView(off, "faq", false)).toEqual(DEFAULT_VIEW)
  })

  it("keeps a part this kind does not use off until the person turns it on", () => {
    expect(viewOff(DEFAULT_VIEW, "stock", true)).toBe(true)
    const on = toggleView(DEFAULT_VIEW, "stock", true)
    expect(on).toEqual({ hidden: [], shown: ["stock"] })
    expect(viewOff(on, "stock", true)).toBe(false)
    // Turned off again: back to its kind's default, nothing hidden by hand
    expect(toggleView(on, "stock", true)).toEqual(DEFAULT_VIEW)
    // On a product that uses it, it stands
    expect(viewOff(DEFAULT_VIEW, "stock", false)).toBe(false)
  })

  it("never turns off a locked part", () => {
    expect(toggleView(DEFAULT_VIEW, "advisor", false)).toBe(DEFAULT_VIEW)
    expect(viewOff({ hidden: ["advisor"], shown: [] }, "advisor", true)).toBe(false)
  })
})
