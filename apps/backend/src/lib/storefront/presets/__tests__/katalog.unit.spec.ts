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

/** The shop's Hakkımızda page (adr/0073 §4). */
const ABOUT = "cnt_01KABOUT0000000000000000"

/** Every handle the preset names, as a shop that has them all would answer. */
const everything: PresetLookups = {
  records: new Map(
    [...katalog.handles].map((ref, index) => [
      ref,
      ref === "page:hakkimizda" ? ABOUT : `pcat_${String(index)}`,
    ])
  ),
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
  images: new Map([["images/acilis-bileme.webp", "/media/acilis-bileme.webp"]]),
}

describe("the katalog preset's draft (adr/0049 Ek 2026-11-14, Katalog ana sayfası)", () => {
  it("makes a design the editor's schema takes, every reference resolved", () => {
    const resolved = resolvePreset(katalog.layout, katalog.menus, everything)
    const doc = presetDocument(resolved, presetTheme(katalog.theme_settings), APPLIED, KEPT)

    expect(resolved.skipped).toEqual([])
    // adr/0067 Ek 2026-11-18: the look's lively motion passes the theme section's schema
    expect(presetTheme(katalog.theme_settings)).toMatchObject({ motion: "lively" })
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
    // The owner (2026-11-15): no quick links under the opening
    expect(doc.home[0]).toHaveProperty("chips.length", 0)
    // The collectors' band shows the shop's special collection; the others split it by price
    const strip = doc.home.find((section) => section.type === "price_bands")
    expect(strip?.type === "price_bands" && strip.bands.map((band) => band.category_id)).toEqual([
      null,
      null,
      null,
      everything.records.get("category:ozel-koleksiyon"),
    ])
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
    // A shop without the special collection keeps the strip without that band (security review)
    expect(resolved.skipped).toContainEqual({
      where: "home.fiyatbantlari",
      ref: "category:ozel-koleksiyon",
    })
    const strip = doc.home.find((section) => section.type === "price_bands")
    expect(strip?.type === "price_bands" && strip.bands.map((band) => band.label)).not.toContain(
      "Koleksiyonluk"
    )
    expect(strip?.type === "price_bands" && strip.bands.length).toBeGreaterThanOrEqual(2)
    expect(doc.home.map((section) => section.id)).toEqual([
      "katalogacilis",
      "coksatanlar",
      "yenigelenler",
      "fiyatbantlari",
      "musteriyorumlari",
    ])
    expect(doc.home[0]).toMatchObject({ chips: [] })
    // No Hakkımızda page yet: its layout is left out, the page named for the panel
    expect(resolved.skipped).toContainEqual({
      where: "pages",
      ref: "page:hakkimizda",
      name: "Hakkımızda",
      reason: "missing",
    })
    expect(doc.pages).toEqual([])
  })
})

describe("the katalog preset's Hakkımızda page (adr/0073 §4)", () => {
  it("lays out the shop's page in one list, as the editor's schema takes it", () => {
    const resolved = resolvePreset(katalog.layout, katalog.menus, everything)
    const doc = presetDocument(resolved, presetTheme(katalog.theme_settings), APPLIED, KEPT)

    expect(resolved.images).toEqual(["images/acilis-bileme.webp"])
    expect(doc.pages.map((page) => page.page_id)).toEqual([ABOUT])
    const sections = doc.pages[0]?.sections ?? []
    // One list since adr/0073 Ek 2026-11-19 (2) K1: the preset's older `placement` read as
    // the stored rule reads it, every section below the page's text, in its order
    expect(sections.map((section) => section.type)).toEqual([
      "rich_text",
      "rich_text",
      "trust_badges",
      "products",
      "reviews",
      "help",
    ])
    expect(sections.some((section) => "placement" in section)).toBe(false)
    expect(sections[0]).toMatchObject({
      variant: "with_image",
      image_side: "end",
      image: { url: "/media/acilis-bileme.webp", alt: "Su taşında bilenen mutfak bıçağı" },
      title: "Ateşten doğan karakter",
    })
    // The second text keeps today's drawing
    expect(sections[1]).toMatchObject({ variant: "pane", title: "Neye inanıyoruz" })
    expect(sections[2]).toMatchObject({ variant: "lined" })
    expect(sections[3]).toMatchObject({
      source: { kind: "best_sellers", days: 90 },
      columns: 4,
      limit: 8,
    })
    expect(sections[4]).toMatchObject({ limit: 6 })
  })

  it("names no record or link inside the page: a shop with the page gets every section", () => {
    const page = katalog.layout.pages?.[0]
    expect(JSON.stringify(page?.sections)).not.toContain("$handle")
    expect(JSON.stringify(page?.sections)).not.toContain("$href")
  })
})
