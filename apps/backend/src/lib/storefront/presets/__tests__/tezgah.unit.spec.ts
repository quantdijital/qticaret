import { storefrontPreset } from "@qticaret/sector-packs"
import { presetDocument, presetTheme } from "../document"
import { resolvePreset } from "../resolve"
import type { PresetLink, PresetLookups } from "../resolve"

/** The Tezgâh preset and its colour siblings (docs/tema/tezgah-tasarim-dili.md). */
const CODES = ["tezgah", "tezgah-lacivert", "tezgah-turuncu"] as const

const read = (code: string) => {
  const preset = storefrontPreset("cutlery", code)
  if (!preset) {
    throw new Error(`no ${code} preset`)
  }
  return preset
}

const tezgah = read("tezgah")

const KEPT = {
  trust_badges: [],
  color_swatches: null,
  low_stock: { enabled: true, threshold: 5 },
}

// A resolved link as `presetLookups` gives it (the union's own fields beside `kind`)
const category = (target: string) => ({ kind: "category", target }) as PresetLink
const system = (target: "shop" | "sale" | "categories") =>
  ({ kind: "system", target }) as PresetLink

/** Every handle and address the preset names, as a shop that has them all would answer. */
const everything: PresetLookups = {
  records: new Map(
    tezgah.handles.map((ref, index) => [
      ref,
      ref.startsWith("product:") ? `prod_${String(index)}` : `pcat_${String(index)}`,
    ])
  ),
  links: new Map<string, PresetLink>([
    ["/magaza", system("shop")],
    ["/kampanyalar", system("sale")],
    ["/kategoriler", system("categories")],
    ["/kategori/av-bicaklari", category("pcat_av")],
    ["/kategori/outdoor-ve-kamp/kamp-bicaklari", category("pcat_kamp")],
    ["/kategori/mutfak-ve-sef-bicaklari/sef-bicaklari", category("pcat_sef")],
  ]),
  images: new Map(),
}

describe("the tezgah presets' drafts (docs/tema/tezgah-tasarim-dili.md)", () => {
  it.each(CODES)(
    "%s makes a design the editor's schema takes, every reference resolved",
    (code) => {
      const preset = read(code)
      const resolved = resolvePreset(preset.layout, preset.menus, everything)
      const doc = presetDocument(
        resolved,
        presetTheme(preset.theme_settings),
        { pack: "cutlery", code, version: preset.version },
        KEPT
      )

      expect(resolved.skipped).toEqual([])
      expect(resolved.dropped).toEqual([])
      expect(doc.home).toHaveLength(15)
      expect(doc.header).toEqual([
        expect.objectContaining({
          type: "header_bar",
          variant: "catalog",
          menu_ground: "stage",
          menu_images: "all",
        }),
      ])
      expect(doc.header[0]).toHaveProperty("highlight_link.kind", "system")
      expect(doc.footer.map((section) => section.type)).toEqual(["footer_bar", "newsletter"])
      expect(doc.footer[0]).toMatchObject({
        social: "icons",
        payment_badges: ["visa", "mastercard", "troy", "bank_transfer", "cash_on_delivery"],
        back_to_top: true,
        back_to_top_shape: "square",
      })
      expect(doc.home.find((section) => section.id === "kullanimagore")).toMatchObject({
        variant: "collage",
        columns: 4,
        columns_mobile: 1,
        height: "medium",
        lead: "on",
        links: 4,
      })
      expect(doc.settings.theme).toMatchObject({
        radius: "sharp",
        buttons: "square",
        section_spacing: "compact",
        surface_style: "lined",
        typography: { heading: "inter", body: "inter" },
        product_card: { variant: "framed", hover_image: false },
      })
    }
  )

  it("leaves out only the close-up in a shop with the pack's skeleton and none of its products", () => {
    const skeleton: PresetLookups = {
      ...everything,
      records: new Map(
        tezgah.handles
          .filter((ref) => ref.startsWith("category:"))
          .map((ref, index) => [ref, `pcat_${String(index)}`])
      ),
    }
    const resolved = resolvePreset(tezgah.layout, tezgah.menus, skeleton)
    const doc = presetDocument(
      resolved,
      presetTheme(tezgah.theme_settings),
      { pack: "cutlery", code: "tezgah", version: tezgah.version },
      KEPT
    )

    expect(resolved.dropped).toEqual(["home.yakinplan"])
    expect(resolved.skipped).toEqual([
      { where: "home.yakinplan", ref: "product:karacelik-alageyik-sam-celigi-av-bicagi" },
    ])
    expect(doc.home.map((section) => section.id)).not.toContain("yakinplan")
    // The price bands still stand between the tabbed rails and the featured one
    expect(doc.home.map((section) => section.id).slice(2, 8)).toEqual([
      "yenirafi",
      "avrafi",
      "kamprafi",
      "sefrafi",
      "fiyatbantlari",
      "coksatanlar",
    ])
  })
})
