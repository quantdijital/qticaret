import type { MedusaContainer } from "@medusajs/framework/types"
import { renderDoc } from "../../lib/content"
import type { BodySection } from "../../lib/storefront/layout"
import type { MenuLinkInput } from "../../lib/storefront/menus"
import type { RailPick } from "../../lib/storefront/rails"
import { fillShopDoc, fillShopText } from "../../lib/shop/tokens"
import type { ShopInfoValues } from "../../lib/shop/tokens"
import { cardTargets } from "../../api/store/content/cards"

/** A button or slide link as the storefront prints it; a broken one is not there. */
export interface StoreLayoutLink {
  /** The shop's wording, else the record's name; null: the storefront's own name. */
  label: string | null
  kind: MenuLinkInput["kind"]
  target: string | null
  /** The record's live path or the address; null: a storefront page or a legal text. */
  path: string | null
}

/** An image with what the media library knows of it: its size and versions. */
export interface StoreLayoutImage {
  url: string
  alt: string | null
  width: number | null
  height: number | null
  derivatives: unknown
}

export type Hydrated = Record<string, unknown> & { id: string; type: string }

/** What the sections are shown with: the shop's details, their links and images as they are now. */
export interface HydrateContext {
  values: ShopInfoValues
  links: Map<MenuLinkInput, StoreLayoutLink | null>
  images: Map<string, StoreLayoutImage>
  container: MedusaContainer
  /** The sale and best-seller rails' products, picked for the shopper's channels, by section id. */
  picks?: ReadonlyMap<string, RailPick>
}

export const fill = (text: string | null, values: ShopInfoValues) =>
  text === null ? null : fillShopText(text, values)

/** A page's section as the storefront prints it (adr/0049), on any page. */
export async function hydrateSection(section: BodySection, at: HydrateContext): Promise<Hydrated> {
  const { id, type } = section
  const image = (url: string, alt: string | null): StoreLayoutImage =>
    at.images.get(url) ?? { url, alt, width: null, height: null, derivatives: null }
  const link = (each: MenuLinkInput | null) => (each ? (at.links.get(each) ?? null) : null)
  switch (section.type) {
    case "hero":
      return {
        id,
        type,
        eyebrow: fill(section.eyebrow, at.values),
        heading: fill(section.heading, at.values),
        text: fill(section.text, at.values),
        links: section.links.flatMap((each) => {
          const shown = link(each)
          return shown ? [shown] : []
        }),
        image: section.image
          ? { ...image(section.image.url, section.image.alt), alt: section.image.alt }
          : null,
      }
    case "banner":
      return {
        id,
        type,
        slides: section.slides.map((slide) => ({
          image: { ...image(slide.image.url, slide.image.alt), alt: slide.image.alt },
          heading: fill(slide.heading, at.values),
          text: fill(slide.text, at.values),
          link: link(slide.link),
        })),
      }
    case "products":
      return {
        id,
        type,
        title: section.title,
        source: section.source,
        limit: section.limit,
        columns: section.columns,
        more: link(section.more),
        // A sale or best-seller rail: its products in order, and whether the newest made it up
        ...at.picks?.get(id),
      }
    case "related_products":
      return {
        id,
        type,
        title: section.title,
        source: section.source,
        limit: section.limit,
        columns: section.columns,
      }
    case "featured_product":
      return {
        id,
        type,
        title: section.title,
        text: fill(section.text, at.values),
        product_id: section.product_id,
      }
    case "rich_text": {
      const body = fillShopDoc(section.body, at.values)
      return {
        id,
        type,
        title: section.title,
        html: renderDoc(body, await cardTargets(at.container, body)),
      }
    }
    case "faq":
      return {
        id,
        type,
        title: section.title,
        items: section.items.map((item) => ({
          question: item.question,
          answer: fillShopText(item.answer, at.values),
        })),
      }
    case "newsletter":
    case "help":
      return { id, type, title: section.title, text: fill(section.text, at.values) }
    case "categories":
      return { id, type, title: section.title, category_ids: section.category_ids }
    case "brands":
      return { id, type, title: section.title, brand_ids: section.brand_ids }
    case "posts":
    case "reviews":
      return { id, type, title: section.title, limit: section.limit }
    case "trust_badges":
      return { id, type }
  }
}
