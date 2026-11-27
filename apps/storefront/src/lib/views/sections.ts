import "server-only"
import type { StoreCategorySection, StoreLayoutSection, StoreProductSection } from "@qticaret/types"
import { deviceOf } from "@qticaret/types/section-device"
import { faqSettingsOf } from "@qticaret/types/section-faq"
import { lookOf } from "@qticaret/types/section-look"
import { reviewsProductImageOf } from "@qticaret/types/section-reviews"
import { scrollerSettingsOf } from "@qticaret/types/section-scroller"
import { trustCardSettingsOf } from "@qticaret/types/section-trust"
import { variantOf } from "@qticaret/types/section-variants"
import type { HomeSectionView, PageTextSectionView, Translate } from "@qticaret/ui"
import { legalIdentity, siteSeo, storefrontSettings } from "@/lib/store-api/requests"
import { googleRatingReviews, reviewSummary } from "@/lib/store-api/extras"
import { shopRatingView } from "./card-extras"
import { heroView, priceBandsView, withCounts } from "./catalog"
import { cardedCategoriesView } from "./category-cards-data"
import { carouselCategoriesView } from "./category-carousel"
import { iconCategoriesView } from "./category-icons"
import { picturedCategories } from "./category-tiles"
import { featuredView } from "./featured"
import { EXCERPT_MIN_RATING, googleRatingView } from "./google-rating"
import { bannerView } from "./banner"
import { heroSliderView } from "./hero-slider"
import { marqueeView } from "./marquee"
import { newsletterLookOf } from "./newsletter"
import { currentShared, isEditorSession, layoutLink } from "./layout"
import { legalDocument, legalPath } from "./legal"
import { postsView } from "./posts-section"
import { brandLinks, categoryLinks, customerPhotoViews, type ProductContext } from "./section-data"
import { reviewViews } from "./review-cards"
import { programView } from "./program"
import { relatedView } from "./related"
import { richTextView } from "./rich-text"
import { socialLinks } from "./frame"
import { needsFlags, withFeatures } from "./section-features"
import { shelfView } from "./shelf"
import { collageView, statsView, stepsView } from "./points"
import { searchBoxParts } from "./natural-search-on"
import { departuresView } from "./departures"
import { stripGalleryView } from "./strip-gallery"
import { contactOf } from "./shop"
import { noteInHand } from "./theme-settings"

export type { ProductContext } from "./section-data"

/** Any section of the design's page groups: the home page's, a product page's, a category page's. */
export type BodySection = StoreLayoutSection | StoreProductSection | StoreCategorySection

/** What a section needs from the page it is on: the product, for its related rails. */
export interface SectionContext {
  product?: ProductContext
  /** The home page: its category cards take a product photo where the category has none. */
  home?: boolean
}

/**
 * One section of the design as the theme draws it (adr/0049): its data
 * fetched here (prices and stock live), its titles in the shop's words or
 * the storefront's. A section with nothing to show is left out.
 */
async function sectionView(
  section: BodySection,
  t: Translate,
  context: SectionContext
): Promise<HomeSectionView | null> {
  const { id } = section
  switch (section.type) {
    case "hero":
      return heroView(section, t)
    case "price_bands":
      return priceBandsView(section, t)
    case "hero_slider":
      return heroSliderView(section, t)
    case "banner":
      // Only a split draws a note (`hand-note.ts`): the theme is read for none other
      return bannerView(section, t, section.variant === "split" && (await noteInHand(section.note)))
    case "categories": {
      // The icon row (adr/0077 §10 Ek): its discs with the shop's icons
      if (section.variant === "icons") {
        return iconCategoriesView(section, t)
      }
      // The sliding picture cards, with the scroller kit's settings
      if (section.variant === "carousel") {
        return carouselCategoriesView(section, t, context.home === true)
      }
      // The carded variants (linked, collage, panels): their cards and own part; else the tiles
      const carded = await cardedCategoriesView(section, t, context.home === true)
      if (carded) {
        const more = layoutLink(section.more ?? null, t)
        return carded.cards.length > 0
          ? {
              id,
              type: "categories",
              title: section.title ?? t("home.shop_categories"),
              categories: carded.cards,
              ...(more ? { more } : {}),
              ...carded.part,
            }
          : null
      }
      // A product's photo stands in for a missing category picture on the home page only
      const categories = context.home
        ? await withCounts(
            await picturedCategories(section.category_ids),
            section.show_count === true
          )
        : await categoryLinks(section.category_ids)
      const more = layoutLink(section.more ?? null, t)
      return categories.length > 0
        ? {
            id,
            type: "categories",
            title: section.title ?? t("home.shop_categories"),
            categories,
            ...(more ? { more } : {}),
          }
        : null
    }
    case "products":
      return shelfView(section, t)
    case "related_products":
      return relatedView(section, t, context.product)
    case "program":
      return programView(section, t, context.product)
    case "brands": {
      const brands = await brandLinks(section.brand_ids)
      return brands.length > 0
        ? { id, type: "brands", title: section.title ?? t("home.brands"), brands }
        : null
    }
    case "posts":
      return postsView(section, t)
    case "featured_product":
      return featuredView(section, t)
    case "reviews": {
      const carousel = variantOf("reviews", section.variant) === "carousel"
      // The product's picture on each card (adr/0077 §10 Ek): a carousel's, once asked for
      const productImage = carousel ? reviewsProductImageOf(section.product_image) : "none"
      const [reviews, photos, rating] = await Promise.all([
        reviewViews(section.limit, t, productImage !== "none"),
        customerPhotoViews(t),
        reviewSummary(),
      ])
      const summary = shopRatingView(rating, t)
      return reviews.length > 0
        ? {
            id,
            type: "reviews",
            title: section.title ?? t("home.reviews"),
            reviews,
            more: { label: t("home.all_reviews"), path: "/yorumlar" },
            // The newest customer photos beside them (adr/0046 Ek 2026-11-04)
            ...(photos.length > 0 ? { photos } : {}),
            // The shop's average, count and spread (adr/0046 Ek 2026-11-05)
            ...(summary ? { summary } : {}),
            // One card each in a sliding row (adr/0077 §10); a grid as before variants
            ...(carousel
              ? { variant: "carousel" as const, scroller: scrollerSettingsOf(section.scroller) }
              : {}),
            ...(productImage !== "none" ? { product_image: productImage } : {}),
          }
        : null
    }
    case "google_rating":
      // Google's figures and excerpts at each request; nothing to show, no section
      return googleRatingView(
        section,
        await googleRatingReviews(section.excerpts, EXCERPT_MIN_RATING),
        t
      )
    case "rich_text":
      return richTextView(section)
    case "faq":
      return section.items.length > 0
        ? {
            id,
            type: "faq",
            title: section.title,
            items: section.items,
            settings: faqSettingsOf(section),
          }
        : null
    case "trust_badges": {
      // The design's badges (adr/0049 Ek 2026-11-06): a preview shows its draft's
      const { trust_badges: badges } = await currentShared()
      // Its variant as the contract knows it: none (an older backend) or a newer one, the default
      const variant = variantOf("trust_badges", section.variant)
      // The card's lift over the section before it, only when on (adr/0077 §10 Ek)
      const lift = variant === "card" && trustCardSettingsOf(section).lift === "on"
      return badges.length > 0
        ? { id, type: "trust_badges", variant, badges, ...(lift ? { lift } : {}) }
        : null
    }
    case "newsletter": {
      const [site, identity, notice] = await Promise.all([
        siteSeo(),
        legalIdentity(),
        legalDocument("privacy_notice"),
      ])
      return {
        id,
        type: "newsletter",
        title: section.title ?? t("newsletter.title"),
        text:
          section.text ?? t("newsletter.text", { shop: identity.company_title ?? site.shop.name }),
        privacyPath: notice ? legalPath("privacy_notice") : null,
        ...newsletterLookOf(section, t, "page"),
      }
    }
    case "marquee":
      return marqueeView(section, t)
    case "strip_gallery":
      return stripGalleryView(section, t)
    case "stats": {
      // The shop's profiles only while the strip shows them
      const profiles = section.social === "on" ? socialLinks((await legalIdentity()).same_as) : []
      // The hand note's face is read only for a strip that has a note
      const hand = section.note ? await noteInHand(section.note) : false
      return statsView(section, t, profiles, hand)
    }
    case "photo_collage":
      return collageView(section, t)
    case "steps":
      return stepsView(section, t)
    case "departures":
      return departuresView(section, t)
    case "search_box":
      // The shop's one search box, its fields the theme's (adr/0077 §1); its hint while sentences are read (§7)
      return {
        id,
        type: "search_box",
        title: section.title,
        intro: section.intro,
        ...(await searchBoxParts(t)),
      }
    case "help": {
      const contact = contactOf(await legalIdentity(), t)
      const reachable = Boolean(contact.whatsappHref ?? contact.phone ?? contact.email)
      return reachable
        ? {
            id,
            type: "help",
            title: section.title ?? t("home.help_title"),
            text: section.text ?? t("home.help_text"),
            contact,
          }
        : null
    }
  }
}

/**
 * A section's look as the theme reads it (adr/0049 Ek 2026-11-14 §6): the
 * steps the shop set that the contract knows (`lookOf`); none, no `look`,
 * so the theme draws its own and the view is as it was before looks. Its
 * screens beside (docs/tema/bilesen-standardi §2), only when not everywhere
 * (`deviceOf`: none or a newer backend's step, everywhere).
 */
export function withLook<V extends HomeSectionView | PageTextSectionView>(
  view: V,
  section: { look?: unknown; device?: unknown }
): V {
  const look = lookOf(section.look)
  const device = deviceOf(section.device)
  const shown: V = Object.keys(look).length > 0 ? { ...view, look } : view
  return device === "all" ? shown : { ...shown, device }
}

/**
 * A page's sections, in the shop's order, each fetched at once; the empty
 * ones left out. In the theme editor's live session each says so
 * (`editor`), so the theme marks its fields (adr/0065 Faz 2b); a live page's
 * views are as they were.
 */
export async function sectionViews(
  sections: readonly BodySection[],
  t: Translate,
  context: SectionContext = {}
): Promise<HomeSectionView[]> {
  // A section whose feature flag is off is not drawn (adr/0077 §8); the frame read only when one needs a flag
  const allowed = needsFlags(sections)
    ? withFeatures(sections, (await storefrontSettings()).features)
    : sections
  const [views, editing] = await Promise.all([
    Promise.all(allowed.map((section) => sectionView(section, t, context))),
    isEditorSession(),
  ])
  return views.flatMap((view, index) => {
    const section = allowed[index]
    if (!view || !section) {
      return []
    }
    const shown = withLook(view, section)
    return [editing ? { ...shown, editor: true as const } : shown]
  })
}

/**
 * A category page's sections by where they go: above the product grid or
 * below it. A content page's are one list (adr/0073 Ek 2026-11-19 (2) K1).
 */
export function byPlacement<S extends { placement?: "top" | "bottom" }>(
  sections: readonly S[]
): {
  top: S[]
  bottom: S[]
} {
  return {
    top: sections.filter((section) => section.placement === "top"),
    bottom: sections.filter((section) => section.placement !== "top"),
  }
}

/**
 * Whether the shop's own rail of the product's category is on the page:
 * the storefront's fixed "similar products" would then show the same twice.
 */
export const showsOwnCategory = (sections: readonly StoreProductSection[]): boolean =>
  sections.some(
    (section) => section.type === "related_products" && section.source.kind === "same_category"
  )
