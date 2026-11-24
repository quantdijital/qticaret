import type { StoreLayout } from "@qticaret/types"
import { FOOTER_BAR_DEFAULTS, FOOTER_COLUMNS_DEFAULTS } from "@qticaret/types/section-footer"
import type { StorefrontPreset } from "@qticaret/sector-packs"
import { BEST_SELLERS, ON_SALE, PRODUCTS } from "./fixture-shop"
import { footerRowsPrint } from "./footer-rows-print"
import { resolveGroup } from "./preset-resolve"
import type { Section } from "./preset-resolve"

/**
 * The fixed shop's `GET /store/storefront-layout` answer once the preset is
 * applied and published: the steps the backend takes between the preset's
 * file and the storefront (`resolvePreset` → `presetDocument` →
 * `storeLayout`, apps/backend/src/workflows/storefront/layout-read.ts),
 * written again here for what changes the page: a hidden section left out,
 * the header bar and the footer bar into `main` (the theme's header where
 * the preset has none), the sale and best-seller rails' and the price bands'
 * products picked, a look only when a step is set, a device only when not
 * everywhere. The backend's section schemas (their defaults) are not run:
 * the storefront reads a missing field as its default, as from an older
 * backend.
 */

export interface PresetAnswer {
  layout: StoreLayout
  /** What the fixture shop lacked: `home.x category:y`, and the sections that went with it. */
  skipped: string[]
  dropped: string[]
}

/** The shop's own trust badges, kept by a preset (`presetDocument`'s `kept`). */
export const SHOP_BADGES = [
  { icon: "truck", title: "Ücretsiz kargo", text: "1.500 TL ve üzeri siparişlerde" },
  { icon: "refresh", title: "14 gün iade", text: "Koşulsuz cayma hakkı" },
  { icon: "shield", title: "Güvenli ödeme", text: "256 bit SSL" },
]

const showing = (section: Section) => section["visible"] !== false

/** The fields a design keeps for its editor and the storefront never prints. */
function printed(section: Section): Section {
  const { look, device, ...rest } = section
  const out: Section = { ...rest }
  delete out["visible"]
  delete out["starts_at"]
  delete out["ends_at"]
  if (look && typeof look === "object" && Object.values(look).some((value) => value !== null)) {
    out["look"] = look
  }
  if (typeof device === "string" && device !== "all") {
    out["device"] = device
  }
  return out
}

const ids = (indexes: readonly number[]) =>
  indexes.flatMap((index) => (PRODUCTS[index] ? [PRODUCTS[index].id] : []))

/** A sale or best-seller source's products, as `railPicks` orders them. */
function picked(source: unknown, limit: number) {
  const kind = (source as { kind?: string } | null)?.kind
  const list = kind === "best_sellers" ? BEST_SELLERS : kind === "on_sale" ? ON_SALE : null
  return list ? { product_ids: list.slice(0, limit), filled_with_newest: false } : {}
}

/** A body section with what the backend picks for it (`hydrateSection`). */
function hydrated(section: Section): Section {
  const out = printed(section)
  if (out.type === "products") {
    const limit = typeof out["limit"] === "number" ? out["limit"] : 12
    const lists = Array.isArray(out["lists"])
      ? (out["lists"] as Record<string, unknown>[]).map((list) => ({
          ...list,
          ...picked(list["source"], typeof out["per_list"] === "number" ? out["per_list"] : 4),
        }))
      : undefined
    return { ...out, ...picked(out["source"], limit), ...(lists ? { lists } : {}) }
  }
  if (out.type === "price_bands") {
    let before: number | null | undefined
    const bands = (out["bands"] as Record<string, unknown>[]).map((band, index) => {
      const max = typeof band["max"] === "number" ? band["max"] : null
      const own = typeof band["category_id"] === "string"
      const min = own || before === undefined || before === null ? null : before + 1
      if (!own) before = max
      const { category_id: category, ...rest } = band
      return {
        ...rest,
        ...(own ? { category_id: category } : {}),
        min,
        max,
        product_ids: ids([index, index + 4]),
      }
    })
    return { ...out, bands }
  }
  return out
}

/**
 * The footer's newsletter box as the store API prints it (`printedNewsletter`):
 * today's words, then each new field only off its default. No preset gives
 * the box a picture, so `image` is not answered here.
 */
function footerNewsletter(box: Section) {
  const variant = typeof box["variant"] === "string" ? box["variant"] : "standard"
  const promise = variant === "split" || variant === "image_card"
  return {
    id: box.id,
    type: box.type,
    title: box["title"],
    text: box["text"],
    ...(variant === "standard" ? {} : { variant }),
    ...(box["description"] ? { description: box["description"] } : {}),
    ...(promise && box["note"] ? { note: box["note"] } : {}),
    ...(promise && box["show_note"] === false ? { show_note: false } : {}),
    ...(variant !== "standard" && variant !== "in_footer" && box["joined"] === true
      ? { joined: true }
      : {}),
  }
}

/** A footer bar's settings, only those set apart from the defaults (`footerSettingsOf`). */
function footerBar(bar: Section | undefined) {
  if (!bar) {
    return { id: "mainfooter", type: "footer_bar" as const, variant: "ledger" }
  }
  const badges = Array.isArray(bar["payment_badges"]) ? bar["payment_badges"] : []
  return {
    id: bar.id,
    type: "footer_bar" as const,
    variant: bar["variant"],
    ...(bar["social"] !== FOOTER_BAR_DEFAULTS.social ? { social: bar["social"] } : {}),
    ...(badges.length > 0 ? { payment_badges: badges } : {}),
    ...(bar["back_to_top"] === true
      ? {
          back_to_top: true,
          back_to_top_side: bar["back_to_top_side"],
          back_to_top_shape: bar["back_to_top_shape"],
          back_to_top_mobile: bar["back_to_top_mobile"],
        }
      : {}),
    // The brand columns footer prints all of its own (`footerColumnsOf`), each its default when unset
    ...(bar["variant"] === "brand_columns"
      ? {
          columns: Object.fromEntries(
            Object.entries(FOOTER_COLUMNS_DEFAULTS).map(([key, value]) => [key, bar[key] ?? value])
          ),
        }
      : {}),
    // The free rows footer prints its ground, its marks and its rows (`footerRowsOf`)
    ...(bar["variant"] === "free_rows" ? footerRowsPrint(bar) : {}),
  }
}

const CATALOG_FIELDS = [
  "search_placeholder",
  "search_label",
  "account_text",
  "cart_total",
  "highlight_link",
  "utility_bar",
  "phone",
  "categories_button",
  "menu_ground",
  // The layout choices (Ek 2026-11-15); a preset without one: null, read as today's drawing
  "tools_place",
  "top_links",
  "search_width",
  // The strip's note (Ek 2026-11-15); a preset without one: none
  "strip_note",
  "strip_note_link",
] as const

/** The header bar as `mainSectionsOf` prints it; none in the preset: the theme's header. */
function headerBar(bar: Section | undefined, theme: Record<string, unknown>) {
  if (!bar) {
    const header = (theme["header"] ?? {}) as { layout?: string; sticky?: boolean }
    return {
      id: "mainheader",
      type: "header_bar" as const,
      variant: header.layout === "centered" ? "centered" : "standard",
      sticky: header.sticky ?? true,
    }
  }
  return {
    id: bar.id,
    type: "header_bar" as const,
    variant: bar["variant"],
    sticky: bar["sticky"],
    // The menus' pictures as the preset names them; none: left to the storefront's reading (`submenus`)
    ...(bar["menu_images"] === undefined ? {} : { menu_images: bar["menu_images"] }),
    // The search's look likewise; none: the box (`field`)
    ...(bar["search_style"] === undefined ? {} : { search_style: bar["search_style"] }),
    ...(bar["variant"] === "catalog"
      ? { catalog: Object.fromEntries(CATALOG_FIELDS.map((key) => [key, bar[key] ?? null])) }
      : {}),
    // Every other header's action button, only once written (`mainSectionsOf`)
    ...(bar["variant"] !== "catalog" && bar["highlight_link"]
      ? { highlight_link: bar["highlight_link"] }
      : {}),
  }
}

const byType = (sections: readonly Section[], type: string) =>
  sections.find((section) => section.type === type)

/** The preset applied to the fixed shop and published, as the storefront is answered. */
export function presetAnswer(preset: StorefrontPreset): PresetAnswer {
  const report = { skipped: [] as string[], dropped: [] as string[] }
  const images = `${preset.pack}/${preset.code}`
  const group = (name: keyof StorefrontPreset["layout"]) =>
    resolveGroup(name, preset.layout[name] ?? [], images, report).filter(showing)
  const header = group("header")
  const footer = group("footer")
  const main = (sections: Section[], type: string, id: string) => {
    const own = byType(sections, type)
    return own ? { ...printed(own) } : { id, type, variant: "standard" }
  }
  const product = group("product")
  const category = group("category")
  const layout = {
    header: header.filter((each) => each.type !== "header_bar").map(printed),
    home: group("home").map(hydrated),
    // The footer group in its order (adr/0070 §4): the box as printed, the others as a page's
    footer: footer
      .filter((each) => each.type !== "footer_bar")
      .map((each) => (each.type === "newsletter" ? footerNewsletter(each) : hydrated(each))),
    product: product.filter((each) => each.type !== "product_main").map(hydrated),
    category: category
      .filter((each) => each.type !== "category_main")
      .map((each) => ({ ...hydrated(each), placement: each["placement"] })),
    main: {
      header_bar: headerBar(byType(header, "header_bar"), preset.theme_settings),
      footer_bar: footerBar(byType(footer, "footer_bar")),
      product_main: main(product, "product_main", "mainproduct"),
      category_main: { by_variant: {}, ...main(category, "category_main", "maincategory") },
    },
    settings: {
      trust_badges: SHOP_BADGES,
      color_swatches: [],
      theme: preset.theme_settings,
      menus: null,
    },
  }
  return { layout: layout as unknown as StoreLayout, ...report }
}
