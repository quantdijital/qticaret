import path from "node:path"
import { layoutDocument } from "../layout"
import { ANNOUNCEMENT_DEFAULTS, ANNOUNCEMENT_SETTINGS } from "../sections/announcement-bar"

// The contract's own file (`@qticaret/types`), through jest: the package is ESM for tsc here
const CONTRACT_FILE = path.resolve(
  __dirname,
  "../../../../../../packages/types/src/store/section-announcement.ts"
)

const bar = (more: Record<string, unknown> = {}) => ({
  id: "duyuru0001",
  type: "announcement_bar",
  lines: ["Kargo bedava", "Aynı gün kargo"],
  ...more,
})
const issues = (doc: Record<string, unknown>) =>
  layoutDocument.safeParse(doc).error?.issues.map((issue) => issue.message) ?? []

describe("the announcement bar's settings (bilesen-denetimi (b) 6)", () => {
  it("reads a bar saved before them as it was drawn: the first line alone", () => {
    const doc = layoutDocument.parse({ header: [bar()] })

    expect(doc.header[0]).toEqual({
      ...bar(),
      // The dark bar, the top strip's design before it had any (owner 2026-11-27)
      variant: "graphite",
      visible: true,
      starts_at: null,
      ends_at: null,
      ...ANNOUNCEMENT_DEFAULTS,
    })
    expect(ANNOUNCEMENT_DEFAULTS.mode).toBe("first")
    // Its lines where they stood (centred on a phone, at the start wide), the bar as tall
    expect(doc.header[0]).toMatchObject({ align: "auto", size: "medium" })
  })

  it("keeps the shop's steps as saved", () => {
    const set = {
      mode: "rotate",
      interval: "slow",
      pause_button: "hover",
      hover_pause: "off",
      align: "right",
      size: "small",
    }
    const doc = layoutDocument.parse({ header: [bar(set)] })

    expect(doc.header[0]).toMatchObject(set)
    expect(layoutDocument.parse({ header: [bar({ mode: "inline" })] }).header[0]).toMatchObject({
      mode: "inline",
      interval: "medium",
    })
  })

  it("refuses a step off its list, and never a bar without its pause button", () => {
    expect(issues({ header: [bar({ mode: "marquee" })] })).toEqual([
      "storefront_layout.section_invalid",
    ])
    expect(issues({ header: [bar({ pause_button: "none" })] })).toEqual([
      "storefront_layout.section_invalid",
    ])
    expect(issues({ header: [bar({ interval: 5 })] })).toEqual([
      "storefront_layout.section_invalid",
    ])
    expect(issues({ header: [bar({ align: "middle" })] })).toEqual([
      "storefront_layout.section_invalid",
    ])
    expect(issues({ header: [bar({ size: "huge" })] })).toEqual([
      "storefront_layout.section_invalid",
    ])
  })

  it("keeps the ground's tone and the button's link, none absent as before", () => {
    const link = { kind: "system" as const, target: "shop" as const, label: "Teklif al" }
    const doc = layoutDocument.parse({ header: [bar({ tone: "primary", link })] })
    expect(doc.header[0]).toMatchObject({ tone: "primary", link })
    expect(layoutDocument.parse({ header: [bar()] }).header[0]).not.toHaveProperty("link")
    expect(issues({ header: [bar({ tone: "green" })] })).toEqual([
      "storefront_layout.section_invalid",
    ])
  })

  it("keeps every alignment and size with every way of showing the lines", () => {
    for (const mode of ANNOUNCEMENT_SETTINGS.mode) {
      for (const align of ANNOUNCEMENT_SETTINGS.align) {
        for (const size of ANNOUNCEMENT_SETTINGS.size) {
          const doc = layoutDocument.parse({ header: [bar({ mode, align, size })] })
          expect(doc.header[0]).toMatchObject({ mode, align, size })
        }
      }
    }
  })

  it("turns like a slider only when asked: fading, no arrows, no line links before", () => {
    const before = layoutDocument.parse({ header: [bar({ mode: "rotate" })] }).header[0]
    expect(before).toMatchObject({ transition: "fade", arrows: "off" })
    expect(before).not.toHaveProperty("line_links")
    const set = { mode: "rotate", transition: "slide", arrows: "on" }
    expect(layoutDocument.parse({ header: [bar(set)] }).header[0]).toMatchObject(set)
    expect(issues({ header: [bar({ transition: "spin" })] })).toEqual([
      "storefront_layout.section_invalid",
    ])
    expect(issues({ header: [bar({ arrows: true })] })).toEqual([
      "storefront_layout.section_invalid",
    ])
  })

  it("keeps each line's own link on the dark bar, checked as every storefront link", () => {
    const shop = { kind: "system" as const, target: "shop" as const, label: null }
    const page = { kind: "url" as const, url: "/kampanyalar", label: "Kampanyalar" }
    const doc = layoutDocument.parse({ header: [bar({ line_links: [shop, null, page] })] })
    expect(doc.header[0]).toMatchObject({ line_links: [shop, null, page] })
    // An address off the shop and not https, a sixth link, a link with no words of its own
    expect(
      issues({
        header: [bar({ line_links: [{ kind: "url", url: "javascript:alert(1)", label: "x" }] })],
      })
    ).not.toEqual([])
    expect(
      issues({ header: [bar({ line_links: Array.from({ length: 6 }, () => shop) })] })
    ).not.toEqual([])
    expect(
      issues({ header: [bar({ line_links: [{ kind: "url", url: "/a", label: "" }] })] })
    ).not.toEqual([])
    // The light strip's note keeps its one link: no line links there
    expect(issues({ header: [bar({ variant: "light", line_links: [shop] })] })).not.toEqual([])
  })

  it("mirrors the contract's lists: a step goes there first", () => {
    const contract = jest.requireActual<Record<string, unknown>>(CONTRACT_FILE)
    expect(ANNOUNCEMENT_SETTINGS).toEqual(contract["ANNOUNCEMENT_SETTINGS"])
    expect(ANNOUNCEMENT_DEFAULTS).toEqual(contract["ANNOUNCEMENT_DEFAULTS"])
  })
})
