import { sectorPacks } from "@qticaret/sector-packs"
import type { StorefrontPreset } from "@qticaret/sector-packs"
import { presetDocument, presetTheme } from "../document"
import { presetMarkers, resolvePreset } from "../resolve"
import type { PresetLink, PresetLookups } from "../resolve"

const KEPT = { trust_badges: [], color_swatches: null, low_stock: null }

// The storefront's own pages a preset links to (menu-hrefs' `SYSTEM_PATHS`)
const SYSTEM: Readonly<Record<string, string>> = {
  "/magaza": "shop",
  "/kampanyalar": "sale",
  "/kategoriler": "categories",
  "/markalar": "brands",
  "/yorumlar": "reviews",
  "/sepet": "cart",
  "/hesap": "account",
  "/siparis": "order_lookup",
  "/blog": "blog",
}

const PREFIX: Readonly<Record<string, string>> = {
  category: "pcat",
  product: "prod",
  collection: "pcol",
  brand: "brand",
  page: "cnt",
}

/** A resolved link as `presetLookups` gives it: a system page, an address kept, a record. */
function linkOf(href: string, index: number): PresetLink {
  const system = SYSTEM[href]
  if (system) {
    return { kind: "system", target: system } as PresetLink
  }
  if (href.startsWith("https://")) {
    return { kind: "url", url: href } as PresetLink
  }
  const kind = href.startsWith("/marka/") ? "brand" : "category"
  return { kind, target: `${PREFIX[kind] ?? "pcat"}_${String(index)}` } as PresetLink
}

/** Every handle, address and picture the preset names, as a shop that has them all would answer. */
function everything(preset: StorefrontPreset): PresetLookups {
  const markers = presetMarkers({ layout: preset.layout, menus: preset.menus })
  return {
    records: new Map(
      preset.handles.map((ref, index) => [
        ref,
        `${PREFIX[ref.split(":")[0] ?? ""] ?? "pcat"}_${String(index)}`,
      ])
    ),
    links: new Map([...markers.hrefs].map((href, index) => [href, linkOf(href, index)])),
    images: new Map(preset.images.map((image) => [image.path, `/static/${image.path}`])),
  }
}

const PRESETS = sectorPacks().flatMap((pack) =>
  pack.presets.map((preset) => [`${pack.code}/${preset.code}`, preset] as const)
)

/**
 * Every ready-made look of every pack, with its content pages (adr/0073
 * §4), held to the editor's own design schema in a shop that has all it
 * names: the section types a content page takes and the page and section
 * limits are the schema's (`layout-pages.ts`, kept equal to
 * `@qticaret/types`' `CONTENT_PAGE_SECTION_TYPES` and `PAGE_LAYOUT_LIMITS`),
 * never a second list in the pack.
 */
describe("every preset's draft (adr/0063 §2, adr/0073 §4)", () => {
  it("has presets to check", () => {
    expect(PRESETS.length).toBeGreaterThan(0)
  })

  it.each(PRESETS)("%s makes a design the editor's schema takes", (_key, preset) => {
    const resolved = resolvePreset(preset.layout, preset.menus, everything(preset))
    const doc = presetDocument(
      resolved,
      presetTheme(preset.theme_settings),
      { pack: preset.pack, code: preset.code, version: preset.version },
      KEPT
    )

    expect(resolved.skipped).toEqual([])
    expect(resolved.dropped).toEqual([])
    expect(doc.pages.map((page) => page.sections.length)).toEqual(
      (preset.layout.pages ?? []).map((page) => page.sections.length)
    )
  })
})
