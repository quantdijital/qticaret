import type { MedusaContainer } from "@medusajs/framework/types"
import { docStats } from "../../lib/content"
import { ValidationError } from "../../lib/errors"
import { bodySections } from "../../lib/storefront/layout"
import type { BodySection, LayoutDocument } from "../../lib/storefront/layout"
import { sliderImages } from "../../lib/storefront/layout-slider"
import type { MenuLinkInput } from "../../lib/storefront/menus"
import { unknownDocTokens } from "../../lib/shop/tokens"
import type { MenuLinkKind } from "../../modules/storefront-menus/service"
import { assertCards, mediaOf } from "../content/rules"
import { existingRecords, isRecordKind } from "./menu-links"

/** Every link a section holds: buttons, slides, "see all". */
export function linksOf(section: BodySection): MenuLinkInput[] {
  if (section.type === "hero") {
    return section.links
  }
  if (section.type === "banner" || section.type === "hero_slider") {
    return section.slides.flatMap((slide) => (slide.link ? [slide.link] : []))
  }
  if (section.type === "products") {
    return section.more ? [section.more] : []
  }
  return []
}

/** Every record a section names by id, as a link would point at it. */
function recordsOf(section: BodySection): { kind: MenuLinkKind; target: string }[] {
  const as = (kind: MenuLinkKind) => (target: string) => ({ kind, target })
  if (section.type === "categories") {
    return section.category_ids.map(as("category"))
  }
  if (section.type === "brands") {
    return section.brand_ids.map(as("brand"))
  }
  if (section.type === "featured_product") {
    return [as("product")(section.product_id)]
  }
  // A rail's or a product page's related products: their category, collection or choice
  if (section.type === "products" || section.type === "related_products") {
    const { source } = section
    return source.kind === "category"
      ? [as("category")(source.category_id)]
      : source.kind === "collection"
        ? [as("collection")(source.collection_id)]
        : source.kind === "manual"
          ? source.product_ids.map(as("product"))
          : []
  }
  return []
}

/** The addresses of every image the design shows: openings, slides, rich text. */
export function imagesOf(section: BodySection): string[] {
  if (section.type === "hero") {
    return section.image ? [section.image.url] : []
  }
  if (section.type === "hero_slider") {
    return sliderImages(section)
  }
  if (section.type === "banner") {
    return section.slides.map((slide) => slide.image.url)
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
 * schema's). Returns the media records it uses, to keep their files.
 */
export async function checkLayout(
  container: MedusaContainer,
  doc: LayoutDocument
): Promise<string[]> {
  const sections = bodySections(doc)
  const targets = sections.flatMap((section) => [
    ...recordsOf(section),
    ...linksOf(section).flatMap((link) =>
      isRecordKind(link.kind) && "target" in link ? [{ kind: link.kind, target: link.target }] : []
    ),
  ])
  const found = await existingRecords(container, targets)
  if (targets.some((each) => !found.has(`${each.kind}:${each.target}`))) {
    throw new ValidationError("storefront_layout.target_unknown", { field: "document" })
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
