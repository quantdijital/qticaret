import "server-only"
import type {
  ProductSource,
  StoreCategorySection,
  StoreLayoutSection,
  StoreProductSection,
} from "@qticaret/types"
import { lookOf } from "@qticaret/types/section-look"
import { variantOf } from "@qticaret/types/section-variants"
import type { HomeSectionView, Translate } from "@qticaret/ui"
import { blogPosts } from "@/lib/store-api/blog"
import { legalIdentity, siteSeo } from "@/lib/store-api/requests"
import { isStoreApiError } from "@/lib/store-api/errors"
import { googleRatingReviews, reviewSummary } from "@/lib/store-api/extras"
import { shopRatingView } from "./card-extras"
import { heroView, priceBandsView, withCounts } from "./catalog"
import { picturedCategories } from "./category-tiles"
import { featuredView } from "./featured"
import { EXCERPT_MIN_RATING, googleRatingView } from "./google-rating"
import { heroSliderView } from "./hero-slider"
import { marqueeView } from "./marquee"
import { currentShared, layoutImage, layoutLink } from "./layout"
import { legalDocument, legalPath } from "./legal"
import { postCards } from "./posts"
import {
  brandLinks,
  categoryLinks,
  customerPhotoViews,
  type ProductContext,
  railCards,
  railProducts,
  relatedProducts,
  reviewViews,
} from "./section-data"
import { contactOf } from "./shop"

export type { ProductContext } from "./section-data"

/** An untitled rail's name by where its products come from; the rest are "Yeni ürünler". */
const RAIL_TITLES: Partial<Record<ProductSource["kind"], string>> = {
  best_sellers: "home.best_sellers",
  on_sale: "home.on_sale",
}

/** Any section of the design's page groups: the home page's, a product page's, a category page's. */
export type BodySection = StoreLayoutSection | StoreProductSection | StoreCategorySection

/** What a section needs from the page it is on: the product, for its related rails. */
export interface SectionContext {
  product?: ProductContext
  /** The home page: its category cards take a product photo where the category has none. */
  home?: boolean
}

/** A related rail under a product; none when its source has nothing else or cannot be read. */
async function relatedView(
  section: Extract<StoreProductSection, { type: "related_products" }>,
  t: Translate,
  context: SectionContext
): Promise<HomeSectionView | null> {
  if (!context.product) {
    return null
  }
  try {
    const products = await relatedProducts(section.source, section.limit, context.product)
    const cards = await railCards(products)
    return cards.length > 0
      ? {
          id: section.id,
          type: "products",
          title: section.title ?? t("product.related"),
          products: cards,
          more: null,
          empty: "",
          columns: section.columns,
        }
      : null
  } catch (error) {
    // A rail the backend could not answer is left out, not the product page
    if (isStoreApiError(error)) {
      return null
    }
    throw error
  }
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
      return {
        id,
        type: "banner",
        slides: section.slides.map((slide) => ({
          image: layoutImage(slide.image, slide.heading ?? ""),
          heading: slide.heading,
          text: slide.text,
          link: layoutLink(slide.link, t),
        })),
      }
    case "categories": {
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
    case "products": {
      const products = await railCards(await railProducts(section))
      // Nothing on sale now: no sale rail, rather than an empty one
      if (products.length === 0 && section.source.kind === "on_sale") {
        return null
      }
      return {
        id,
        type: "products",
        title: section.title ?? t(RAIL_TITLES[section.source.kind] ?? "home.products"),
        products,
        more: layoutLink(section.more, t),
        empty: t("home.no_products"),
        columns: section.columns,
      }
    }
    case "related_products":
      return relatedView(section, t, context)
    case "brands": {
      const brands = await brandLinks(section.brand_ids)
      return brands.length > 0
        ? { id, type: "brands", title: section.title ?? t("home.brands"), brands }
        : null
    }
    case "posts": {
      const { entries } = await blogPosts(0, section.limit)
      return entries.length > 0
        ? {
            id,
            type: "posts",
            title: section.title ?? t("home.posts"),
            posts: postCards(entries, t),
            more: { label: t("home.all_posts"), path: "/blog" },
          }
        : null
    }
    case "featured_product":
      return featuredView(section, t)
    case "reviews": {
      const [reviews, photos, rating] = await Promise.all([
        reviewViews(section.limit, t),
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
      return { id, type: "rich_text", title: section.title, html: section.html }
    case "faq":
      return section.items.length > 0
        ? { id, type: "faq", title: section.title, items: section.items }
        : null
    case "trust_badges": {
      // The design's badges (adr/0049 Ek 2026-11-06): a preview shows its draft's
      const { trust_badges: badges } = await currentShared()
      // Its variant as the contract knows it: none (an older backend) or a newer one, the default
      const variant = variantOf("trust_badges", section.variant)
      return badges.length > 0 ? { id, type: "trust_badges", variant, badges } : null
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
      }
    }
    case "marquee":
      return marqueeView(section, t)
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
 * so the theme draws its own and the view is as it was before looks.
 */
function withLook(view: HomeSectionView, section: BodySection): HomeSectionView {
  const look = lookOf(section.look)
  return Object.keys(look).length > 0 ? { ...view, look } : view
}

/** A page's sections, in the shop's order, each fetched at once; the empty ones left out. */
export async function sectionViews(
  sections: readonly BodySection[],
  t: Translate,
  context: SectionContext = {}
): Promise<HomeSectionView[]> {
  const views = await Promise.all(sections.map((section) => sectionView(section, t, context)))
  return views.flatMap((view, index) => {
    const section = sections[index]
    return view && section ? [withLook(view, section)] : []
  })
}

/** A category page's sections by where they go: above the product grid, or below it. */
export function byPlacement(sections: readonly StoreCategorySection[]): {
  top: StoreCategorySection[]
  bottom: StoreCategorySection[]
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
