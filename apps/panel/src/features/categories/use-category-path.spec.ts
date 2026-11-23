import { describe, expect, it } from "vitest"
import { categoryPathOf } from "./use-category-path"

describe("categoryPathOf (docs/13 §2.2, adr/0017 Ek 2026-11-23)", () => {
  const handles = ["hediyelik-esyalar", "caki-kutusu"]

  it("carries the tree with the prefix, without it, or only the category's own handle", () => {
    expect(categoryPathOf(handles, "prefixed")).toBe("/kategori/hediyelik-esyalar/caki-kutusu")
    expect(categoryPathOf(handles, "nested")).toBe("/hediyelik-esyalar/caki-kutusu")
    expect(categoryPathOf(handles, "flat")).toBe("/caki-kutusu")
  })

  it("gives a root category the same path nested and flat", () => {
    expect(categoryPathOf(["hediyelik-esyalar"], "nested")).toBe("/hediyelik-esyalar")
    expect(categoryPathOf(["hediyelik-esyalar"], "flat")).toBe("/hediyelik-esyalar")
  })
})
