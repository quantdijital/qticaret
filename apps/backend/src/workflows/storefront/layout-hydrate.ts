import type { MedusaContainer } from "@medusajs/framework/types"
import { renderDoc } from "../../lib/content"
import type { BodySection } from "../../lib/storefront/layout"
import { MARQUEE_SETTING_NAMES } from "../../lib/storefront/sections/marquee"
import type {
  HeaderMarquee,
  MarqueeSection,
  MarqueeSettingName,
} from "../../lib/storefront/sections/marquee"
import type { MenuLinkInput, RecordLinkKind } from "../../lib/storefront/menus"
import type { RailPick } from "../../lib/storefront/rails"
import { FEATURED_STRIPS_SETTINGS } from "../../lib/storefront/sections/featured-product"
import { printedNewsletter } from "../../lib/storefront/sections/newsletter"
import { hasLook } from "../../lib/storefront/sections/look"
import { shownDevice } from "../../lib/storefront/layout-fields"
import { fillShopDoc, fillShopText } from "../../lib/shop/tokens"
import type { ShopInfoValues } from "../../lib/shop/tokens"
import { cardTargets } from "../../api/store/content/cards"
import { hydrateHero, hydratePriceBands } from "./layout-hydrate-catalog"
import { hydrateArticle, hydrateContact, hydrateFaq } from "./layout-hydrate-text"
import { hydrateShelf } from "./layout-hydrate-shelf"
import { hydrateStrips } from "./layout-hydrate-strips"
import { hydrateCollage, hydrateDepartures, hydratePoints } from "./layout-hydrate-points"
import { hydrateBanner, hydratePosts } from "./layout-hydrate-band"
import type { BandPick } from "./price-bands"

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
  /** The price bands strips' products per band, picked for the shopper's channels, by section id. */
  bands?: ReadonlyMap<string, BandPick>
  /** Whether a record is live now (`liveRecords`); none: all are. */
  live?: (kind: RecordLinkKind, id: string) => boolean
}

export const fill = (text: string | null, values: ShopInfoValues) =>
  text === null ? null : fillShopText(text, values)

/**
 * A scrolling strip as the storefront prints it (adr/0049 Ek 2026-11-14
 * §4.1), on a page or in the header: its items' words filled, their links
 * placed (a broken one null, the item kept), its steps as saved.
 */
const settingsOf = (section: MarqueeSection | HeaderMarquee) =>
  Object.fromEntries(MARQUEE_SETTING_NAMES.map((name) => [name, section[name]])) as Pick<
    MarqueeSection,
    MarqueeSettingName
  >

export function hydrateMarquee(section: MarqueeSection | HeaderMarquee, at: HydrateContext) {
  return {
    id: section.id,
    type: section.type,
    items: section.items.map((item) => ({
      icon: item.icon,
      text: fillShopText(item.text, at.values),
      subtext: fill(item.subtext, at.values),
      link: item.link ? (at.links.get(item.link) ?? null) : null,
    })),
    ...settingsOf(section),
    // Which screens show it (every section's since docs/tema/bilesen-standardi §2), only when not all
    ...shownDevice(section.device),
  }
}

/**
 * A page's section as the storefront prints it (adr/0049), on any page;
 * its look only when the shop set a step (adr/0049 Ek 2026-11-14 §6) and
 * its screens only when not everywhere (docs/tema/bilesen-standardi §2), so
 * a section drawn the theme's own way prints as it did before them.
 */
export async function hydrateSection(section: BodySection, at: HydrateContext): Promise<Hydrated> {
  const shown = { ...(await hydrateBody(section, at)), ...shownDevice(section.device) }
  return hasLook(section.look) ? { ...shown, look: section.look } : shown
}

async function hydrateBody(section: BodySection, at: HydrateContext): Promise<Hydrated> {
  const { id, type } = section
  const image = (url: string, alt: string | null): StoreLayoutImage =>
    at.images.get(url) ?? { url, alt, width: null, height: null, derivatives: null }
  const link = (each: MenuLinkInput | null) => (each ? (at.links.get(each) ?? null) : null)
  const band = { fill: (text: string | null) => fill(text, at.values), link, image }
  switch (section.type) {
    case "hero":
      return hydrateHero(section, { fill: (text) => fill(text, at.values), link, image })
    case "price_bands":
      return hydratePriceBands(section, at.bands?.get(id), (text) => fill(text, at.values))
    case "banner":
      return hydrateBanner(section, band)
    case "hero_slider":
      return {
        id,
        type,
        slides: section.slides.map((slide) => ({
          image: { ...image(slide.image.url, slide.image.alt), alt: slide.image.alt },
          mobile_image: slide.mobile_image
            ? {
                ...image(slide.mobile_image.url, slide.mobile_image.alt),
                alt: slide.mobile_image.alt,
              }
            : null,
          heading: fill(slide.heading, at.values),
          text: fill(slide.text, at.values),
          link: link(slide.link),
          position: slide.position,
          tone: slide.tone,
        })),
        height: section.height,
        // The kit's settings (bilesen-denetimi (b) 4); saved seconds only while no step keeps them
        scroller: section.scroller,
        ...(section.interval === undefined ? {} : { interval: section.interval }),
      }
    case "products":
      return hydrateShelf(section, at.picks, link(section.more))
    case "related_products":
      return {
        id,
        type,
        title: section.title,
        source: section.source,
        limit: section.limit,
        // Each printed only off its default, so a rail from before them prints as it did
        ...(section.card_variant ? { card_variant: section.card_variant } : {}),
        ...(section.variant === "carousel"
          ? { variant: section.variant, scroller: section.scroller }
          : {
              columns: section.columns,
              ...(section.columns_mobile === 1 ? { columns_mobile: 1 as const } : {}),
            }),
      }
    case "program":
      // adr/0078: the steps are the product's, read by the storefront for its page
      return {
        id,
        type,
        title: section.title,
        variant: section.variant,
        // A tab beside the description; absent: its own section (today's)
        ...(section.place === "tab" ? { place: "tab" as const } : {}),
      }
    case "featured_product":
      return {
        id,
        type,
        title: section.title,
        text: fill(section.text, at.values),
        product_id: section.product_id,
        // Printed only off the collage, so a section from before it prints as it did;
        // the strips' look with them, every step (adr/0049 Ek 2026-11-16)
        ...(section.gallery === "strips"
          ? {
              gallery: section.gallery,
              ...Object.fromEntries(FEATURED_STRIPS_SETTINGS.map((name) => [name, section[name]])),
            }
          : {}),
      }
    case "strip_gallery":
      return hydrateStrips(section, {
        fill: (text) => fill(text, at.values),
        link,
        image,
        live: at.live,
      })
    case "rich_text": {
      // A content page's own text (adr/0073 Ek 2026-11-19 (2) K2), as the page printed it
      if (section.variant === "article") {
        return hydrateArticle(section, at)
      }
      const body = fillShopDoc(section.body, at.values)
      const html = renderDoc(body, await cardTargets(at.container, body))
      // The pane prints as it did before variants
      if (section.variant !== "with_image") {
        return { id, type, title: section.title, html }
      }
      // The picture beside it (adr/0073 §3): its alt the shop's, else the media library's
      const known = image(section.image.url, section.image.alt)
      return {
        id,
        type,
        title: section.title,
        html,
        variant: section.variant,
        image: { ...known, alt: section.image.alt ?? known.alt },
        image_side: section.image_side,
      }
    }
    case "faq":
      return hydrateFaq(section, at)
    case "newsletter":
      // Each new field only off its default (adr/0049 Ek 2026-11-17 e-bülten)
      return printedNewsletter(section, (text) => fill(text, at.values), image)
    case "help":
      return { id, type, title: section.title, text: fill(section.text, at.values) }
    case "categories":
      return {
        id,
        type,
        title: section.title,
        category_ids: section.category_ids,
        // Printed only when set, so a section from before them prints as it did
        ...(section.show_count ? { show_count: true } : {}),
        ...(section.more ? { more: link(section.more) } : {}),
        // Today's tiles print no variant, as before variants (adr/0049 Ek 2026-11-15)
        ...(section.variant === "linked"
          ? {
              variant: section.variant,
              columns: section.columns,
              // Printed only when not the default (1), as the settings before it
              ...(section.columns_mobile === 2 ? { columns_mobile: 2 as const } : {}),
              image_position: section.image_position,
              frame: section.frame,
              links: section.links,
            }
          : {}),
        // The panels print the collage's fields under their own name (Ek 2026-11-19)
        ...(section.variant === "collage" || section.variant === "panels"
          ? {
              variant: section.variant,
              columns: section.columns,
              ...(section.columns_mobile === 2 ? { columns_mobile: 2 as const } : {}),
              height: section.height,
              lead: section.lead,
              links: section.links,
            }
          : {}),
        // The icon row (adr/0077 §10 Ek): its settings and the icons of the categories it names
        ...(section.variant === "icons"
          ? {
              variant: section.variant,
              disc: section.disc,
              phone: section.phone,
              // Printed only off the default, so a row before it prints as it did
              ...(section.row_style !== "stacked" ? { row_style: section.row_style } : {}),
              ...(section.category_handles && section.category_handles.length > 0
                ? { category_handles: section.category_handles }
                : {}),
              category_icons: Object.fromEntries(
                Object.entries(section.category_icons).filter(([id]) =>
                  section.category_ids.includes(id)
                )
              ),
              // By handle (a preset's): printed only once written, so a row before it prints as it did
              ...(section.category_icons_by_handle &&
              Object.keys(section.category_icons_by_handle).length > 0
                ? { category_icons_by_handle: section.category_icons_by_handle }
                : {}),
            }
          : {}),
      }
    case "brands":
      return { id, type, title: section.title, brand_ids: section.brand_ids }
    case "posts":
      return hydratePosts(section, band)
    case "reviews":
      // A grid prints as before variants; a carousel names itself and its scroller (adr/0077 §10)
      return section.variant === "carousel"
        ? {
            id,
            type,
            title: section.title,
            limit: section.limit,
            variant: section.variant,
            scroller: section.scroller,
            // The product's picture on each card, only once written (adr/0077 §10 Ek)
            ...(section.product_image ? { product_image: section.product_image } : {}),
          }
        : { id, type, title: section.title, limit: section.limit }
    case "trust_badges":
      // The badges are the shared settings'; the section says where and how it is drawn
      return {
        id,
        type,
        variant: section.variant,
        // The card's lift, only on the card (adr/0077 §10 Ek)
        ...(section.variant === "card" ? { lift: section.lift } : {}),
      }
    case "marquee":
      return hydrateMarquee(section, at)
    case "stats":
    case "steps":
      return hydratePoints(section, { fill: (text) => fill(text, at.values), link })
    case "search_box":
      // The box's fields are the theme's (adr/0077 §1); the section gives its words
      return {
        id,
        type,
        title: section.title,
        intro: fill(section.intro, at.values),
      }
    case "photo_collage":
      return hydrateCollage(section, { fill: (text) => fill(text, at.values), link, image })
    case "departures":
      return hydrateDepartures(section, { fill: (text) => fill(text, at.values), link })
    case "contact":
      return hydrateContact(section, at)
    case "payment_facts":
    case "shipping_facts":
      // The live facts are the storefront's to read; the section says where they stand
      return { id, type }
  }
}
