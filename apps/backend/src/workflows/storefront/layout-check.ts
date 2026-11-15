import type { MedusaContainer } from "@medusajs/framework/types"
import { docStats } from "../../lib/content"
import { ValidationError } from "../../lib/errors"
import { bodySections } from "../../lib/storefront/layout"
import type { BodySection, HeaderSection, LayoutDocument } from "../../lib/storefront/layout"
import { bannerImages, bannerLinks } from "../../lib/storefront/sections/banner"
import { sliderImages } from "../../lib/storefront/sections/hero-slider"
import { shelfSources } from "../../lib/storefront/sections/products"
import type { MenuLinkInput } from "../../lib/storefront/menus"
import { unknownDocTokens } from "../../lib/shop/tokens"
import type { MenuLinkKind } from "../../modules/storefront-menus/service"
import { assertCards, mediaOf } from "../content/rules"
import { existingRecords, isRecordKind } from "./menu-links"

/** Every link a section holds: buttons, slides, "see all", a scrolling strip's items. */
export function linksOf(section: BodySection | HeaderSection): MenuLinkInput[] {
  if (section.type === "marquee") {
    return section.items.flatMap((item) => (item.link ? [item.link] : []))
  }
  if (section.type === "hero") {
    // H17's quick links beside its buttons
    return section.variant === "category_list"
      ? [...section.links, ...section.chips]
      : section.links
  }
  if (section.type === "categories") {
    return section.more ? [section.more] : []
  }
  if (section.type === "banner") {
    return bannerLinks(section)
  }
  if (section.type === "hero_slider") {
    return section.slides.flatMap((slide) => (slide.link ? [slide.link] : []))
  }
  if (section.type === "products") {
    return section.more ? [section.more] : []
  }
  // The catalog header's highlighted last link (adr/0049 Ek 2026-11-15)
  if (section.type === "header_bar" && section.variant === "catalog") {
    return section.highlight_link ? [section.highlight_link] : []
  }
  return []
}

/**
 * The header's sections that hold links: its scrolling strip and the
 * catalog header bar (the announcement's lines are words).
 */
export const headerLinked = (doc: Pick<LayoutDocument, "header">): HeaderSection[] =>
  doc.header.filter(
    (section) =>
      section.type === "marquee" || (section.type === "header_bar" && section.variant === "catalog")
  )

/** Every record a section names by id, as a link would point at it. */
function recordsOf(section: BodySection): { kind: MenuLinkKind; target: string }[] {
  const as = (kind: MenuLinkKind) => (target: string) => ({ kind, target })
  if (section.type === "categories") {
    return section.category_ids.map(as("category"))
  }
  // H17: its list's picked categories, its tiles' categories and its products shown small
  if (section.type === "hero") {
    return section.variant === "category_list"
      ? [
          ...(section.list.kind === "manual" ? section.list.category_ids : []).map(as("category")),
          ...section.tiles.map((tile) => as("category")(tile.category_id)),
          ...section.picks.map((pick) => as("product")(pick.product_id)),
        ]
      : []
  }
  if (section.type === "brands") {
    return section.brand_ids.map(as("brand"))
  }
  // A price band's own category (adr/0049, 2026-11-15)
  if (section.type === "price_bands") {
    return section.bands.flatMap((band) =>
      band.category_id ? [as("category")(band.category_id)] : []
    )
  }
  if (section.type === "featured_product") {
    return [as("product")(section.product_id)]
  }
  // A rail's or a product page's related products: their category, collection or choice
  // (each of a columns rail's lists too)
  if (section.type === "products" || section.type === "related_products") {
    const sources =
      section.type === "products"
        ? shelfSources(section).map(({ source }) => source)
        : [section.source]
    return sources.flatMap((source) =>
      source.kind === "category"
        ? [as("category")(source.category_id)]
        : source.kind === "collection"
          ? [as("collection")(source.collection_id)]
          : source.kind === "manual"
            ? source.product_ids.map(as("product"))
            : []
    )
  }
  return []
}

/** The addresses of every image the design shows: openings, slides, rich text. */
export function imagesOf(section: BodySection): string[] {
  if (section.type === "hero") {
    const tiles = section.variant === "category_list" ? section.tiles : []
    return [section.image, ...tiles.map((tile) => tile.image)].flatMap((each) =>
      each ? [each.url] : []
    )
  }
  if (section.type === "hero_slider") {
    return sliderImages(section)
  }
  if (section.type === "banner") {
    return bannerImages(section)
  }
  if (section.type === "rich_text") {
    return docStats(section.body).images.map((each) => each.src)
  }
  return []
}

/**
 * What a saved design must hold (adr/0049): records that exist (a draft
 * one counts: it shows once live), images the shop uploaded, rich text
 * whose cards exist and whose `{belirteç}`s are the shop's details. The
 * home, product and category pages' sections go through the same checks
 * (the plain lines' `{belirteç}`s, a FAQ's answers among them, are the
 * schema's); the header's scrolling strip links only records that exist
 * too. A menu set the design carries (adr/0063 §3) links only
 * records that exist, as the Menüler screen asks (`storefront_menus.target_unknown`).
 * Returns the media records it uses, to keep their files.
 */
export async function checkLayout(
  container: MedusaContainer,
  doc: LayoutDocument
): Promise<string[]> {
  const sections = bodySections(doc)
  const recordLinks = (section: BodySection | HeaderSection) =>
    linksOf(section).flatMap((link) =>
      isRecordKind(link.kind) && "target" in link ? [{ kind: link.kind, target: link.target }] : []
    )
  const targets = [
    ...sections.flatMap((section) => [...recordsOf(section), ...recordLinks(section)]),
    ...headerLinked(doc).flatMap(recordLinks),
  ]
  const menuTargets = (doc.settings.menus ?? []).flatMap((menu) =>
    menu.items
      .flatMap((each) => [each.link, ...each.children])
      .flatMap((link) =>
        isRecordKind(link.kind) && "target" in link
          ? [{ kind: link.kind, target: link.target }]
          : []
      )
  )
  const found = await existingRecords(container, [...targets, ...menuTargets])
  const missing = (list: typeof targets) =>
    list.some((each) => !found.has(`${each.kind}:${each.target}`))
  if (missing(targets)) {
    throw new ValidationError("storefront_layout.target_unknown", { field: "document" })
  }
  if (missing(menuTargets)) {
    throw new ValidationError("storefront_menus.target_unknown", { field: "document" })
  }
  for (const section of sections) {
    if (section.type === "rich_text") {
      if (unknownDocTokens(section.body).length > 0) {
        throw new ValidationError("storefront_layout.token_unknown", { field: "document" })
      }
      await assertCards(container, section.body)
    }
  }
  return mediaOf(container, sections.flatMap(imagesOf), "document")
}
