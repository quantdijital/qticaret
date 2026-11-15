import { describe, expect, it } from "vitest"
import { diffCaptures, groupChanges, isSame, parentKey, sameValue, subtreeRoots } from "../diff.ts"
import { formatReport, shortKey } from "../report.ts"
import type { Capture, ElementStyle } from "../types.ts"

const capture = (elements: Record<string, ElementStyle>): Capture => ({
  page: "home",
  path: "/",
  width: 1440,
  state: "load",
  elements,
})

const card = "[data-qs=coksatanlar] > div[1] > ul[1] > li[1] > article[1]"
const exact = { tolerance: 0 }
const loose = { tolerance: 0.5 }

describe("resolved style comparison", () => {
  it("finds the same drawing the same, whatever the classes were", () => {
    const before = capture({
      [card]: { t: "Çakı", s: { display: "flex", width: 240, height: 320 } },
    })
    const after = capture({
      [card]: { t: "Çakı", s: { display: "flex", width: 240, height: 320 } },
    })
    expect(isSame(diffCaptures("home@1440.json", before, after, exact))).toBe(true)
  })

  it("names the element and the property that changed, old value to new", () => {
    const before = capture({ [card]: { t: "Çakı", s: { width: 240, height: 320 } } })
    const after = capture({
      [card]: {
        t: "Çakı",
        s: { "box-shadow": "rgba(0, 0, 0, 0.2) 0px 4px 8px 0px", width: 240, height: 320 },
      },
    })
    const diff = diffCaptures("home@1440.json", before, after, exact)
    expect(diff.changed).toEqual([
      {
        key: card,
        text: "Çakı",
        changes: [
          { prop: "box-shadow", before: "none", after: "rgba(0, 0, 0, 0.2) 0px 4px 8px 0px" },
        ],
      },
    ])
    expect(diff.added).toEqual([])
    expect(diff.removed).toEqual([])
  })

  it("reads a property left out as its default, so dropping a default is no change", () => {
    const before = capture({ [card]: { s: { "border-radius": "0px", width: 1, height: 1 } } })
    const after = capture({ [card]: { s: { width: 1, height: 1 } } })
    expect(isSame(diffCaptures("f", before, after, exact))).toBe(true)
  })

  it("lets pixel differences within the tolerance pass, and no more", () => {
    expect(sameValue("240.4", "240", 0.5)).toBe(true)
    expect(sameValue("240.6", "240", 0.5)).toBe(false)
    expect(sameValue("12.25px 16px", "12px 16px", 0.5)).toBe(true)
    expect(sameValue("12px 16px", "12px 17px", 0.5)).toBe(false)
    expect(sameValue("12.25px 16px", "12px 16px", 0)).toBe(false)
    // Colours are not lengths: a channel off by one is a change
    expect(sameValue("rgb(10, 10, 10)", "rgb(10, 10, 11)", 0.5)).toBe(false)
    expect(sameValue("1px solid red", "1px dashed red", 0.5)).toBe(false)
  })

  it("keeps added and removed elements apart from style changes", () => {
    const before = capture({
      body: { s: { width: 1440, height: 900 } },
      [card]: { t: "Çakı", s: {} },
    })
    const after = capture({
      body: { s: { width: 1440, height: 900 } },
      [`${card} > div[1]`]: { t: "yeni", s: {} },
    })
    const diff = diffCaptures("f", before, after, loose)
    expect(diff.changed).toEqual([])
    expect(diff.removed).toEqual([{ key: card, text: "Çakı" }])
    expect(diff.added).toEqual([{ key: `${card} > div[1]`, text: "yeni" }])
  })

  it("reads a wrapper added around a list as one change with its insides counted", () => {
    const top = "body > div[1]"
    const roots = subtreeRoots([
      { key: top, text: "" },
      { key: `${top} > ul[1]`, text: "" },
      { key: `${top} > ul[1] > li[1]`, text: "a" },
      { key: `${top} > ul[1] > li[1]::before`, text: "" },
      { key: "body > footer[1]", text: "alt" },
    ])
    expect(roots.map(({ ref, inside }) => [ref.key, inside])).toEqual([
      [top, 3],
      ["body > footer[1]", 0],
    ])
    expect(parentKey(`${top} > ul[1]::after`)).toBe(`${top} > ul[1]`)
    expect(parentKey("[data-qs=mainheader]")).toBeNull()
  })

  it("groups one change made on many elements into one line", () => {
    const change = { prop: "color", before: "rgb(0, 0, 0)", after: "rgb(1, 1, 1)" }
    const groups = groupChanges([
      { key: "a", text: "", changes: [change] },
      { key: "b", text: "", changes: [change, { prop: "opacity", before: "1", after: "0.5" }] },
    ])
    expect(groups.map((g) => [g.change.prop, g.elements.length])).toEqual([
      ["color", 2],
      ["opacity", 1],
    ])
  })
})

describe("resolved style report", () => {
  const options = { limit: 2, fullKeys: false, tolerance: 0.5 }
  const empty = { onlyBefore: [], onlyAfter: [], skippedBefore: [], skippedAfter: [] }

  it("says N/N the same when nothing changed", () => {
    const same = diffCaptures("home@1440.json", capture({}), capture({}), loose)
    expect(formatReport({ ...empty, diffs: [same, same] }, options)).toBe(
      "çözülmüş stil 2/2 aynı, ≤0.5 px fark yok sayıldı"
    )
  })

  it("prints page, width, element, property and old → new, and counts what it cuts", () => {
    const keys = ["a", "b", "c"].map((k) => `${card} > ${k}[1]`)
    const before = capture(Object.fromEntries(keys.map((k) => [k, { t: "Sepete ekle", s: {} }])))
    const after = capture(
      Object.fromEntries(keys.map((k) => [k, { t: "Sepete ekle", s: { "border-radius": "8px" } }]))
    )
    const report = formatReport(
      {
        ...empty,
        diffs: [diffCaptures("home@1440.json", before, after, loose)],
        skippedAfter: [{ page: "home", width: 1440, state: "categories-open", reason: "none" }],
      },
      options
    )
    expect(report).toContain("## home (/) 1440 px  [home@1440.json]")
    expect(report).toContain("border-radius: 0px → 8px  (3 öğe)")
    expect(report).toContain("«Sepete ekle»")
    expect(report).toContain("… 1 öğe daha")
    expect(report).toContain("durum categories-open")
    expect(report.endsWith("çözülmüş stil 0/1 aynı, 1 farklı, ≤0.5 px fark yok sayıldı")).toBe(true)
  })

  it("counts a capture only one side has as different", () => {
    const report = formatReport({ ...empty, diffs: [], onlyAfter: ["home@390.json"] }, options)
    expect(report).toContain("yalnız yenide: home@390.json")
    expect(report).toContain("çözülmüş stil 0/1 aynı")
  })

  it("shortens a long key to its section and last steps", () => {
    expect(shortKey(`${card} > a[1]`, false)).toBe(
      "[data-qs=coksatanlar] > … > li[1] > article[1] > a[1]"
    )
    expect(shortKey(`${card} > a[1]`, true)).toBe(`${card} > a[1]`)
  })
})
