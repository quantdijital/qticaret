import { readStoredLayout } from "../layout"
import { TOP_STRIP_SEPARATE, withSeparateTopStrip } from "../top-strip-legacy"

/**
 * A design stored before the top strip was its own section (owner's
 * decision 2026-11-27, adr/0066 Ek) is read into it once, drawing what it
 * drew: the strip section in the old drawing's design and parts, the
 * header bar marked. A marked design is read as it is.
 */

const ALWAYS = { visible: true, starts_at: null, ends_at: null }
const bar = (extra: Record<string, unknown> = {}) => ({
  id: "mainheader",
  type: "header_bar",
  ...ALWAYS,
  ...extra,
})
const announcement = (extra: Record<string, unknown> = {}) => ({
  id: "duyurular",
  type: "announcement_bar",
  ...ALWAYS,
  lines: ["Kargo bedava"],
  ...extra,
})
const header = (...sections: Record<string, unknown>[]) =>
  withSeparateTopStrip({ header: sections })["header"] as Record<string, unknown>[]
const stripOf = (sections: Record<string, unknown>[]) =>
  sections.find((section) => section["type"] === "announcement_bar")

describe("the top strip read out of the header (owner 2026-11-27)", () => {
  it("leaves a design already read into it as it is", () => {
    const marked = { header: [bar({ variant: "catalog", top_strip: TOP_STRIP_SEPARATE })] }
    expect(withSeparateTopStrip(marked)).toBe(marked)
  })

  it("marks the header bar, and keeps the dark bar the standard and centred headers drew", () => {
    for (const variant of [undefined, "standard", "centered"]) {
      const read = header(bar(variant ? { variant } : {}))
      expect(read).toEqual([
        { id: "ustserit", type: "announcement_bar", ...ALWAYS, lines: [], variant: "graphite" },
        expect.objectContaining({ type: "header_bar", top_strip: TOP_STRIP_SEPARATE }),
      ])
      // With its lines: the same bar, its design named, every part shown
      expect(stripOf(header(announcement(), bar(variant ? { variant } : {})))).toEqual({
        ...announcement(),
        variant: "graphite",
      })
    }
    // A design without a header bar: the theme's header, the same dark bar
    expect(header()).toEqual([expect.objectContaining({ id: "ustserit", variant: "graphite" })])
  })

  it("keeps the one-row header's lines alone, and draws nothing there without them", () => {
    expect(stripOf(header(bar({ variant: "inline" })))).toBeUndefined()
    expect(stripOf(header(announcement(), bar({ variant: "inline" })))).toEqual({
      ...announcement(),
      variant: "graphite",
      links: false,
      phone: false,
    })
  })

  it("turns the catalog header's own strip into the light strip, its note, link and parts", () => {
    const link = { kind: "system", target: "sale", label: null }
    expect(
      stripOf(
        header(bar({ variant: "catalog", strip_note: " Kargo bedava ", strip_note_link: link }))
      )
    ).toEqual({
      id: "ustserit",
      type: "announcement_bar",
      ...ALWAYS,
      variant: "light",
      lines: ["Kargo bedava"],
      link,
      // "Hesabım" written: the tools on the menu bar (the default) and the word on
      account: true,
    })
    expect(
      stripOf(header(bar({ variant: "catalog", top_links: "bar", tools_place: "row" })))
    ).toEqual({
      id: "ustserit",
      type: "announcement_bar",
      ...ALWAYS,
      variant: "light",
      lines: [],
      links: false,
    })
  })

  it("gives the dark bar what the catalog header left it once its strip was off", () => {
    const off = { variant: "catalog", utility_bar: false }
    // The links fell to the bar above; the phone stayed by the search
    expect(stripOf(header(bar(off)))).toMatchObject({ variant: "graphite", phone: false })
    expect(stripOf(header(bar(off)))).not.toHaveProperty("links")
    // Links on the menu bar and the phone by the search: nothing was drawn above
    expect(stripOf(header(bar({ ...off, top_links: "bar" })))).toBeUndefined()
    // The phone off by the search fell to the bar above
    expect(stripOf(header(bar({ ...off, top_links: "bar", phone: false })))).toMatchObject({
      variant: "graphite",
      links: false,
    })
  })

  it("keeps the announcement beside a catalog strip, the links in it (two strips cannot be one)", () => {
    expect(stripOf(header(announcement(), bar({ variant: "catalog" })))).toEqual({
      ...announcement(),
      variant: "graphite",
      phone: false,
    })
  })

  it("names the strip apart from the design's other sections", () => {
    const read = withSeparateTopStrip({
      header: [bar()],
      home: [{ id: "ustserit", type: "rich_text" }],
    })
    expect(stripOf(read["header"] as Record<string, unknown>[])).toMatchObject({
      id: "ustserit2",
    })
  })

  it("reads whole through today's schema, and the same again once saved", () => {
    const first = readStoredLayout({ header: [bar({ variant: "catalog", strip_note: "Not" })] })
    expect(first.header.map((section) => section.type)).toEqual(["announcement_bar", "header_bar"])
    const again = readStoredLayout(JSON.parse(JSON.stringify(first)))
    expect(again).toEqual(first)
  })
})
