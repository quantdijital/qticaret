import { themeSection } from "../../../../modules/platform-settings/sections/theme"
import { layoutDocument, readStoredLayout } from "../../layout"
import type { LayoutDocument } from "../../layout"
import { designDigest, rawDigest } from "../digest"
import { autoToEvict } from "../evict"
import { DESIGN_ID, DESIGN_LIMITS } from "../limits"
import { nameKey } from "../names"
import { HOME_TYPES_SHOWN, designSummary, partsOf } from "../summary"

const GRAFIT = themeSection.defaults
const HEX64 = /^[0-9a-f]{64}$/

const baseDoc = (): LayoutDocument =>
  layoutDocument.parse({
    home: [
      { id: "yazilar1", type: "posts" },
      { id: "yazilar2", type: "posts", title: "Günlük" },
    ],
    settings: { theme: GRAFIT },
  })

const withSettings = (doc: LayoutDocument, settings: Record<string, unknown>): LayoutDocument => ({
  ...doc,
  settings: { ...doc.settings, ...settings },
})

describe("a look's digest (adr/0064 Ek 2026-11-17 §1.3)", () => {
  it("reads a value the same whatever its keys' order, without undefined keys", () => {
    const one = rawDigest({ b: [1, { y: 2, x: null }], a: "ç" })
    expect(one).toMatch(HEX64)
    expect(rawDigest({ a: "ç", b: [1, { x: null, y: 2 }] })).toBe(one)
    expect(rawDigest({ a: "ç", b: [1, { x: null, y: 2 }], c: undefined })).toBe(one)
    expect(rawDigest({ a: "c", b: [1, { x: null, y: 2 }] })).not.toBe(one)
    // An array's order is its meaning
    expect(rawDigest({ a: "ç", b: [{ x: null, y: 2 }, 1] })).not.toBe(one)
  })

  it("survives a trip through the database: stored as JSON and read again", () => {
    const doc = baseDoc()
    const again = readStoredLayout(JSON.parse(JSON.stringify(doc)))
    expect(designDigest(again)).toBe(designDigest(doc))
    expect(designDigest(doc)).toMatch(HEX64)
  })

  it("leaves out the labels, the menu set and the shop's own data an apply keeps", () => {
    const doc = baseDoc()
    const digest = designDigest(doc)
    for (const settings of [
      { design: { id: "sfd_01A", digest: "a".repeat(64) } },
      { preset: { pack: "cutlery", code: "katalog", version: 3 } },
      { menus: [{ title: "Ana menü", location: "main", rank: 0, items: [] }] },
      { trust_badges: [] },
      { color_swatches: [{ label: "siyah", hex: "#111111" }] },
      { low_stock: { enabled: true, threshold: 4 } },
    ]) {
      expect(designDigest(withSettings(doc, settings))).toBe(digest)
    }
  })

  it("tells a changed theme or section apart", () => {
    const doc = baseDoc()
    const digest = designDigest(doc)
    expect(designDigest(withSettings(doc, { theme: { ...GRAFIT, radius: "sharp" } }))).not.toBe(
      digest
    )
    const home = doc.home.map((section, at) =>
      at === 0 ? { ...section, title: "Yeni başlık" } : section
    )
    expect(designDigest({ ...doc, home })).not.toBe(digest)
    expect(designDigest({ ...doc, home: [...doc.home].reverse() })).not.toBe(digest)
  })
})

describe("a look's card summary", () => {
  const origin = { source: "preset" as const, source_name: "Katalog", edited: false, reason: null }

  it("reads the colours, faces, section counts and the first home types", () => {
    const home = Array.from({ length: HOME_TYPES_SHOWN + 2 }, (_, at) => ({
      id: `b${String(at)}`,
      type: at % 2 ? "posts" : "faq",
    }))
    const summary = designSummary(
      {
        groups: { home, header: [{ type: "announcement" }], footer: "not a list" },
        theme: GRAFIT,
        preset: { pack: "cutlery", code: "katalog", version: 2 },
      },
      origin
    )
    expect(summary).toEqual({
      ...origin,
      preset: { pack: "cutlery", code: "katalog", version: 2 },
      colors: {
        primary: GRAFIT.colors.primary,
        accent: GRAFIT.colors.accent,
        background: GRAFIT.colors.background,
      },
      fonts: { heading: GRAFIT.typography.heading, body: GRAFIT.typography.body },
      sections: { header: 1, home: HOME_TYPES_SHOWN + 2, footer: 0, product: 0, category: 0 },
      home_types: home.slice(0, HOME_TYPES_SHOWN).map((section) => section.type),
    })
  })

  it("reads what it cannot as null or none, never failing", () => {
    for (const document of [null, "x", 7, [], { settings: "x", home: [{ type: 3 }, null] }]) {
      const summary = designSummary(partsOf(document), { ...origin, source: "own" })
      expect(summary.preset).toBeNull()
      expect(summary.colors).toEqual({ primary: null, accent: null, background: null })
      expect(summary.fonts).toEqual({ heading: null, body: null })
      expect(summary.home_types).toEqual([])
    }
    expect(
      designSummary(
        { groups: {}, theme: null, preset: { pack: "cutlery", code: "katalog", version: "2" } },
        origin
      ).preset
    ).toBeNull()
  })

  it("reads a stored document's groups and settings", () => {
    const doc = baseDoc()
    const parts = partsOf(JSON.parse(JSON.stringify(doc)))
    expect(parts.theme).toEqual(GRAFIT)
    expect(designSummary(parts, origin).sections.home).toBe(2)
  })
})

describe("a saved look's name and id", () => {
  it("compares names trimmed, in Turkish lower case", () => {
    expect(nameKey("  İstanbul ")).toBe("istanbul")
    expect(nameKey("İstanbul")).toBe(nameKey("istanbul"))
    expect(nameKey("IŞIK")).toBe("ışık")
    expect(nameKey("ISPARTA")).not.toBe(nameKey("isparta"))
  })

  it("takes only a saved look's id", () => {
    expect(DESIGN_ID.test("sfd_01JABCDEFGHJKMNPQRSTVWXYZ")).toBe(true)
    for (const wrong of ["sfd_", "prod_01A", "sfd_01A/../x", "SFD_01A", `sfd_${"a".repeat(41)}`]) {
      expect(DESIGN_ID.test(wrong)).toBe(false)
    }
  })

  it("keeps the owner's limits: ten named, five automatic, a megabyte, sixty characters", () => {
    expect(DESIGN_LIMITS).toEqual({ saved: 10, auto: 5, bytes: 1_000_000, name: 60 })
  })
})

describe("the automatic saves removed past the limit", () => {
  const row = (id: string, created_at: string) => ({ id, created_at })

  it("removes none within the limit", () => {
    expect(autoToEvict([row("sfd_a", "2026-11-17T10:00:00Z")], 5)).toEqual([])
    expect(autoToEvict([], 5)).toEqual([])
  })

  it("removes the oldest beyond it, a tie by id, leaving the input as it was", () => {
    const rows = [
      row("sfd_f", "2026-11-17T15:00:00Z"),
      row("sfd_b", "2026-11-17T10:00:00Z"),
      row("sfd_a", "2026-11-17T10:00:00Z"),
      row("sfd_e", "2026-11-17T14:00:00Z"),
      row("sfd_d", "2026-11-17T13:00:00Z"),
      row("sfd_c", "2026-11-17T12:00:00Z"),
      row("sfd_g", "2026-11-17T16:00:00Z"),
    ]
    const before = rows.map((each) => each.id)
    expect(autoToEvict(rows, 5).map((each) => each.id)).toEqual(["sfd_a", "sfd_b"])
    expect(rows.map((each) => each.id)).toEqual(before)
  })

  it("orders dates and their text alike", () => {
    const rows = [
      { id: "sfd_new", created_at: new Date("2026-11-17T12:00:00Z") },
      { id: "sfd_old", created_at: "2026-11-16T12:00:00Z" },
    ]
    expect(autoToEvict(rows, 1).map((each) => each.id)).toEqual(["sfd_old"])
  })

  it("never removes the one kept (the look being applied): the next oldest goes", () => {
    const rows = [
      row("sfd_a", "2026-11-17T10:00:00Z"),
      row("sfd_b", "2026-11-17T11:00:00Z"),
      row("sfd_c", "2026-11-17T12:00:00Z"),
      row("sfd_d", "2026-11-17T13:00:00Z"),
      row("sfd_e", "2026-11-17T14:00:00Z"),
      row("sfd_new", "2026-11-17T15:00:00Z"),
    ]
    expect(autoToEvict(rows, 5, "sfd_a").map((each) => each.id)).toEqual(["sfd_b"])
    expect(autoToEvict(rows, 5, "sfd_c").map((each) => each.id)).toEqual(["sfd_a"])
    expect(autoToEvict(rows, 5, "sfd_named").map((each) => each.id)).toEqual(["sfd_a"])
    expect(autoToEvict(rows, 5, null).map((each) => each.id)).toEqual(["sfd_a"])
  })
})
