import "server-only"
import type { StoreCategorySection, StoreLayoutSection, StoreProductSection } from "@qticaret/types"
import type { HomeSectionView, LinkView, Translate } from "@qticaret/ui"
import { blogPosts } from "@/lib/store-api/blog"
import { legalIdentity, siteSeo, storefrontSettings } from "@/lib/store-api/requests"
import { isStoreApiError } from "@/lib/store-api/errors"
import { reviewSummary } from "@/lib/store-api/extras"
import { shopRatingView } from "./card-extras"
import { featuredView } from "./featured"
import { layoutImage, layoutLink } from "./layout"
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

/** Any section of the design's page groups: the home page's, a product page's, a category page's. */
export type BodySection = StoreLayoutSection | StoreProductSection | StoreCategorySection

/** What a section needs from the page it is on: the product, for its related rails. */
export interface SectionContext {
  product?: ProductContext
}

const links = (items: readonly (LinkView | null)[]): LinkView[] =>
  items.flatMap((item) => (item ? [item] : []))

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
    case "hero": {
      const site = await siteSeo()
      return {
        id,
        type: "hero",
        eyebrow: section.eyebrow,
        heading: section.heading ?? site.shop.name,
        intro: section.text,
        actions: links(section.links.map((link) => layoutLink(link, t))),
        image: section.image ? layoutImage(section.image, section.heading ?? site.shop.name) : null,
      }
    }
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
      const categories = await categoryLinks(section.category_ids)
      return categories.length > 0
        ? { id, type: "categories", title: section.title ?? t("home.shop_categories"), categories }
        : null
    }
    case "products":
      return {
        id,
        type: "products",
        title: section.title ?? t("home.products"),
        products: await railCards(await railProducts(section.source, section.limit)),
        more: layoutLink(section.more, t),
        empty: t("home.no_products"),
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
    case "rich_text":
      return { id, type: "rich_text", title: section.title, html: section.html }
    case "faq":
      return section.items.length > 0
        ? { id, type: "faq", title: section.title, items: section.items }
        : null
    case "trust_badges": {
      const { storefront } = await storefrontSettings()
      return storefront.trust_badges.length > 0
        ? { id, type: "trust_badges", badges: storefront.trust_badges }
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
      }
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

/** A page's sections, in the shop's order, each fetched at once; the empty ones left out. */
export async function sectionViews(
  sections: readonly BodySection[],
  t: Translate,
  context: SectionContext = {}
): Promise<HomeSectionView[]> {
  const views = await Promise.all(sections.map((section) => sectionView(section, t, context)))
  return views.flatMap((view) => (view ? [view] : []))
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
