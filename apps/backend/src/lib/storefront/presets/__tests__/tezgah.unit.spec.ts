import { storefrontPreset } from "@qticaret/sector-packs"
import { presetDocument, presetTheme } from "../document"
import { presetMarkers, resolvePreset } from "../resolve"
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

// The storefront's own pages the preset links to (menu-hrefs' `SYSTEM_PATHS`)
const SYSTEM: Readonly<Record<string, string>> = {
  "/magaza": "shop",
  "/kampanyalar": "sale",
  "/kategoriler": "categories",
  "/markalar": "brands",
  "/yorumlar": "reviews",
  "/sepet": "cart",
  "/hesap": "account",
  "/siparis": "order_lookup",
}

/** A resolved link as `presetLookups` gives it: a system page, a brand or a category. */
function linkOf(href: string, index: number): PresetLink {
  const system = SYSTEM[href]
  if (system) {
    return { kind: "system", target: system } as PresetLink
  }
  const kind = href.startsWith("/marka/") ? "brand" : "category"
  return { kind, target: `${kind === "brand" ? "brand" : "pcat"}_${String(index)}` } as PresetLink
}

const markers = presetMarkers({ layout: tezgah.layout, menus: tezgah.menus })

/** Every handle, address and picture the preset names, as a shop that has them all would answer. */
const everything: PresetLookups = {
  records: new Map(
    tezgah.handles.map((ref, index) => [
      ref,
      ref.startsWith("product:") ? `prod_${String(index)}` : `pcat_${String(index)}`,
    ])
  ),
  links: new Map([...markers.hrefs].map((href, index) => [href, linkOf(href, index)])),
  images: new Map(tezgah.images.map((image) => [image.path, `/static/${image.path}`])),
}

const draft = (code: string, lookups: PresetLookups) => {
  const preset = read(code)
  const resolved = resolvePreset(preset.layout, preset.menus, lookups)
  const doc = presetDocument(
    resolved,
    presetTheme(preset.theme_settings),
    { pack: "cutlery", code, version: preset.version },
    KEPT
  )
  return { resolved, doc }
}

describe("the tezgah presets' drafts (docs/tema/tezgah-tasarim-dili.md)", () => {
  it.each(CODES)(
    "%s makes a design the editor's schema takes, every reference resolved",
    (code) => {
      const { resolved, doc } = draft(code, everything)

      expect(resolved.skipped).toEqual([])
      expect(resolved.dropped).toEqual([])
      expect(resolved.images).toEqual(tezgah.images.map((image) => image.path))
      expect(doc.home).toHaveLength(18)
      expect(doc.header).toEqual([
        expect.objectContaining({
          type: "header_bar",
          variant: "catalog",
          menu_ground: "stage",
          menu_images: "all",
          search_style: "icon",
          strip_note: "{ücretsiz_kargo_eşiği} üzeri siparişlerde kargo bedava",
        }),
      ])
      expect(doc.header[0]).toHaveProperty("strip_note_link.target", "sale")
      expect(doc.footer.map((section) => section.type)).toEqual(["footer_bar", "newsletter"])
      expect(doc.product.map((section) => section.type)).toEqual([
        "product_main",
        "trust_badges",
        "related_products",
        "faq",
      ])
      expect(doc.category.map((section) => section.type)).toEqual(["category_main", "trust_badges"])
      const opening = doc.home[0] as { slides?: { image: { url: string } | null }[] }
      expect(opening.slides?.map((slide) => slide.image?.url)).toEqual([
        "/static/images/acilis-sef-bicaklari.webp",
        "/static/images/acilis-kamp.webp",
        "/static/images/acilis-indirim.webp",
        "/static/images/acilis-bileme.webp",
      ])
      expect(doc.home.find((section) => section.id === "kullanimagore")).toMatchObject({
        variant: "collage",
        columns: 4,
        height: "medium",
        lead: "on",
        links: 5,
      })
      expect(doc.settings.theme).toMatchObject({
        radius: "sharp",
        buttons: "square",
        surface_style: "lined",
        typography: { heading: "inter", body: "inter" },
        product_card: { variant: "framed", hover_image: true },
      })
    }
  )

  it("in a shop with the pack's skeleton and none of its products, leaves out only the close-up", () => {
    const skeleton: PresetLookups = {
      ...everything,
      records: new Map(
        tezgah.handles
          .filter((ref) => ref.startsWith("category:"))
          .map((ref, index) => [ref, `pcat_${String(index)}`])
      ),
    }
    const { resolved, doc } = draft("tezgah", skeleton)

    expect(resolved.dropped).toEqual(["home.yakinplan"])
    // The opening names no product (it has no small products), so only the close-up's goes
    expect(resolved.skipped).toEqual([
      { where: "home.yakinplan", ref: "product:karacelik-alageyik-sam-celigi-av-bicagi" },
    ])
    const ids = doc.home.map((section) => section.id)
    expect(ids).not.toContain("yakinplan")
    expect(ids[0]).toBe("tezgahacilis")
    expect(doc.home[0]).toMatchObject({ picks: [], tiles: [{}, {}] })
    expect(doc.home).toHaveLength(17)
  })
})
