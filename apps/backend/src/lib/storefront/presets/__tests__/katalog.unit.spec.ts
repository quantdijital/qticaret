import { storefrontPreset } from "@qticaret/sector-packs"
import { presetDocument, presetTheme } from "../document"
import { resolvePreset } from "../resolve"
import type { PresetLookups } from "../resolve"

const katalog = storefrontPreset("cutlery", "katalog")
if (!katalog) {
  throw new Error("no katalog preset")
}

const KEPT = {
  trust_badges: [],
  color_swatches: null,
  low_stock: { enabled: true, threshold: 5 },
}
const APPLIED = { pack: "cutlery", code: "katalog", version: katalog.version }

/** Every handle the preset names, as a shop that has them all would answer. */
const everything: PresetLookups = {
  records: new Map([...katalog.handles].map((ref, index) => [ref, `pcat_${String(index)}`])),
  links: new Map([
    ["/magaza", { kind: "system" as const, target: "shop" as const }],
    [
      "/kategori/kilic-modelleri/minyatur-kiliclar",
      { kind: "category" as const, target: "pcat_a" },
    ],
    ["/kategori/mutfak-sef-serisi/mutfak-setleri", { kind: "category" as const, target: "pcat_b" }],
    [
      "/kategori/kasap-bicaklari/kasap-bicak-setleri",
      { kind: "category" as const, target: "pcat_c" },
    ],
    [
      "/kategori/hediyelik-esyalar/ahsap-caki-kutulari",
      { kind: "category" as const, target: "pcat_d" },
    ],
    ["/kategori/mutfak-sef-serisi", { kind: "category" as const, target: "pcat_e" }],
    ["/kategori/el-yapimi-caki", { kind: "category" as const, target: "pcat_f" }],
  ]),
  images: new Map(),
}

describe("the katalog preset's draft (adr/0049 Ek 2026-11-14, Katalog ana sayfası)", () => {
  it("makes a design the editor's schema takes, every reference resolved", () => {
    const resolved = resolvePreset(katalog.layout, katalog.menus, everything)
    const doc = presetDocument(resolved, presetTheme(katalog.theme_settings), APPLIED, KEPT)

    expect(resolved.skipped).toEqual([])
    expect(doc.home.map((section) => section.type)).toEqual([
      "hero",
      "products",
      "products",
      "products",
      "price_bands",
      "products",
      "categories",
      "reviews",
    ])
    expect(doc.home[0]).toMatchObject({
      variant: "category_list",
      tiles: [{ category_id: expect.stringMatching(/^pcat_/) as unknown }, expect.anything()],
    })
    expect(doc.home[0]).toHaveProperty("chips.length", 4)
  })

  it("leaves out what a shop without those categories lacks, keeping the rest", () => {
    // A knife shop with only the pack's skeleton: the tiles' categories, nothing of the steel row
    const skeleton: PresetLookups = {
      ...everything,
      records: new Map([
        ["category:kamp-baltalari", "pcat_kamp"],
        ["category:sef-bicaklari", "pcat_sef"],
      ]),
      links: new Map([["/magaza", { kind: "system" as const, target: "shop" as const }]]),
    }
    const resolved = resolvePreset(katalog.layout, katalog.menus, skeleton)
    const doc = presetDocument(resolved, presetTheme(katalog.theme_settings), APPLIED, KEPT)

    expect(resolved.dropped).toEqual(["home.kilicrafi", "home.mutfakrafi", "home.celiksap"])
    expect(doc.home.map((section) => section.id)).toEqual([
      "katalogacilis",
      "coksatanlar",
      "yenigelenler",
      "fiyatbantlari",
      "musteriyorumlari",
    ])
    expect(doc.home[0]).toMatchObject({ chips: [] })
  })
})
