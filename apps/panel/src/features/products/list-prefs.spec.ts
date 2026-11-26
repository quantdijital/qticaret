import { afterEach, describe, expect, it } from "vitest"
import { DEFAULT_PREFS, parsePrefs, readPrefs } from "./list-prefs"

describe("the product list's screen options", () => {
  afterEach(() => {
    window.localStorage.clear()
  })

  it("keeps only the page sizes and columns the list knows", () => {
    expect(parsePrefs({ pageSize: 50, hidden: ["seo", "nope", "updated"] })).toEqual({
      pageSize: 50,
      hidden: ["updated", "seo"],
    })
    expect(parsePrefs({ pageSize: 37, hidden: "seo" })).toEqual(DEFAULT_PREFS)
    expect(parsePrefs(null)).toEqual(DEFAULT_PREFS)
  })

  it("is read per person, the defaults when nothing or nonsense is stored", () => {
    window.localStorage.setItem(
      "qt.panel.products.list.v1:user_a",
      JSON.stringify({ pageSize: 100, hidden: ["category"] })
    )
    window.localStorage.setItem("qt.panel.products.list.v1:user_c", "{not json")

    expect(readPrefs("user_a")).toEqual({ pageSize: 100, hidden: ["category"] })
    expect(readPrefs("user_b")).toEqual(DEFAULT_PREFS)
    expect(readPrefs("user_c")).toEqual(DEFAULT_PREFS)
  })
})
