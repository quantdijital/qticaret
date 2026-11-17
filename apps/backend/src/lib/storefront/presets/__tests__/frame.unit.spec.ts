import { presetDocument, presetTheme, withShopFrame } from "../document"
import { resolvePreset } from "../resolve"
import { ANNOUNCEMENT_DEFAULTS } from "../../sections/announcement-bar"
import type { PresetGroups, PresetLookups } from "../resolve"
import { fixturePreset } from "./fixture-packs"

// A test-local look shaped as Atölye's default: the mechanism, not a shipped look
const preset = fixturePreset()

const lookups: PresetLookups = {
  records: new Map(),
  links: new Map([["/magaza", { kind: "system" as const, target: "shop" as const }]]),
  images: new Map(),
}
const KEPT = { trust_badges: null, color_swatches: null, low_stock: null }
const APPLIED = { pack: "general", code: "sade", version: preset.version }
const ALWAYS = { visible: true, starts_at: null, ends_at: null }

const announcements = {
  id: "duyurular",
  type: "announcement_bar",
  ...ALWAYS,
  lines: ["Kargo bedava"],
}
const newsletter = { id: "magazabulteni", type: "newsletter", ...ALWAYS }
const empty: PresetGroups = { header: [], home: [], footer: [], product: [], category: [] }

describe("the shop's header and footer under a preset (adr/0063 §4)", () => {
  it("keeps the shop's sections in a group the preset leaves empty, naming them", () => {
    const groups = { ...empty, footer: [{ id: "ebultenkutusu", type: "newsletter" }] }

    const out = withShopFrame(groups, { header: [announcements], footer: [newsletter] })

    expect(out.groups.header).toEqual([announcements])
    // The preset fills the footer: the preset's stands
    expect(out.groups.footer).toEqual(groups.footer)
    expect(out.kept).toEqual(["header.duyurular"])
  })

  it("keeps nothing when the shop's group is empty too, and leaves the body groups alone", () => {
    const out = withShopFrame(empty, { header: [], footer: [] })

    expect(out.groups).toEqual(empty)
    expect(out.kept).toEqual([])
  })

  it("keeps the shop's footer when every section the preset wrote there was dropped", () => {
    const out = withShopFrame(empty, { header: [], footer: [newsletter] })

    expect(out.groups.footer).toEqual([newsletter])
    expect(out.kept).toEqual(["footer.magazabulteni"])
  })

  it("writes a preset with no header of its own with the shop's announcement bar kept", () => {
    const resolved = resolvePreset(preset.layout, preset.menus, lookups)
    const frame = withShopFrame(resolved.groups, { header: [announcements], footer: [newsletter] })

    const doc = presetDocument(
      { groups: frame.groups, menus: resolved.menus },
      presetTheme(preset.theme_settings),
      APPLIED,
      KEPT
    )

    // Its settings filled with the defaults: the first line alone, as before (bilesen-denetimi (b) 6)
    expect(doc.header).toEqual([{ ...announcements, ...ANNOUNCEMENT_DEFAULTS }])
    expect(doc.footer.map((section) => section.id)).toEqual(["ebultenkutusu"])
    expect(frame.kept).toEqual(["header.duyurular"])
  })
})
