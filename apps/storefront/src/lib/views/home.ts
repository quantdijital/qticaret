import "server-only"
import type { ProductSource, StoreLayoutSection, StoreProduct } from "@qticaret/types"
import type { HomeSectionView, LinkView, Translate } from "@qticaret/ui"
import {
  allCategories,
  blogPosts,
  legalIdentity,
  listProducts,
  pathsOf,
  priceDisplays,
  siteSeo,
  storefrontSettings,
} from "@/lib/store-api/requests"
import { isStoreApiError } from "@/lib/store-api/errors"
import { storeGet } from "@/lib/store-api/server"
import { childrenOf } from "./categories"
import { layoutImage, layoutLink } from "./layout"
import { legalDocument, legalPath } from "./legal"
import { postCards } from "./posts"
import { productCards, variantIdsOf } from "./product"
import { contactOf } from "./shop"

const DATE = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Istanbul",
})

const links = (items: readonly (LinkView | null)[]): LinkView[] =>
  items.flatMap((item) => (item ? [item] : []))

/** A rail's products from the source the shop chose; a hand-picked rail keeps its order. */
async function railProducts(source: ProductSource, limit: number): Promise<StoreProduct[]> {
  switch (source.kind) {
    case "newest":
      return (await listProducts({ limit, order: "-created_at" })).products
    case "category":
      return (
        await listProducts({ limit, order: "-created_at", categoryIds: [source.category_id] })
      ).products
    case "collection":
      return (
        await listProducts({ limit, order: "-created_at", collectionIds: [source.collection_id] })
      ).products
    case "manual": {
      const ids = source.product_ids.slice(0, limit)
      const { products } = await listProducts({ limit: ids.length, ids })
      const byId = new Map(products.map((product) => [product.id, product]))
      return ids.flatMap((id) => byId.get(id) ?? [])
    }
  }
}

async function categoryLinks(ids: readonly string[]): Promise<LinkView[]> {
  const categories = await allCategories()
  const chosen =
    ids.length > 0
      ? ids.flatMap((id) => categories.find((category) => category.id === id) ?? [])
      : childrenOf(categories, null)
  const paths = await pathsOf(
    "product_category",
    chosen.map((category) => category.id)
  )
  return chosen.flatMap((category) => {
    const path = paths[category.id]
    return path ? [{ label: category.name, path }] : []
  })
}

async function brandLinks(ids: readonly string[]): Promise<LinkView[]> {
  const { brands } = await storeGet<{ brands: { id: string; name: string }[] }>("/store/brands", {
    limit: 100,
  })
  const chosen =
    ids.length > 0 ? ids.flatMap((id) => brands.find((brand) => brand.id === id) ?? []) : brands
  const paths = await pathsOf(
    "brand",
    chosen.map((brand) => brand.id)
  )
  return chosen.flatMap((brand) => {
    const path = paths[brand.id]
    return path ? [{ label: brand.name, path }] : []
  })
}

interface ReviewsAnswer {
  reviews: {
    product_id: string
    product_title: string
    rating: number
    title: string | null
    body: string
    author_name: string | null
    created_at: string
    verified_purchase: boolean
  }[]
}

async function reviewViews(limit: number, t: Translate) {
  let answer: ReviewsAnswer
  try {
    answer = await storeGet<ReviewsAnswer>("/store/reviews", { offset: 0, limit })
  } catch (error) {
    if (!isStoreApiError(error)) {
      throw error
    }
    return []
  }
  const paths = await pathsOf(
    "product",
    answer.reviews.map((review) => review.product_id)
  )
  return answer.reviews.map((review) => {
    const path = paths[review.product_id]
    return {
      rating: review.rating,
      title: review.title,
      body: review.body,
      author: review.author_name ?? t("product.anonymous"),
      date: DATE.format(new Date(review.created_at)),
      verified: review.verified_purchase,
      product: path ? { label: review.product_title, path } : null,
    }
  })
}

/**
 * One section of the design as the theme draws it (adr/0049): its data
 * fetched here (prices and stock live), its titles in the shop's words or
 * the storefront's. A section with nothing to show is left out.
 */
async function sectionView(
  section: StoreLayoutSection,
  t: Translate
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
    case "products": {
      const products = await railProducts(section.source, section.limit)
      const [paths, displays] = await Promise.all([
        pathsOf(
          "product",
          products.map((product) => product.id)
        ),
        priceDisplays(variantIdsOf(products)),
      ])
      return {
        id,
        type: "products",
        title: section.title ?? t("home.products"),
        products: productCards(products, paths, displays),
        more: layoutLink(section.more, t),
        empty: t("home.no_products"),
      }
    }
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
    case "reviews": {
      const reviews = await reviewViews(section.limit, t)
      return reviews.length > 0
        ? {
            id,
            type: "reviews",
            title: section.title ?? t("home.reviews"),
            reviews,
            more: { label: t("home.all_reviews"), path: "/yorumlar" },
          }
        : null
    }
    case "rich_text":
      return { id, type: "rich_text", title: section.title, html: section.html }
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

/** The home page's sections, in the shop's order, each fetched at once. */
export async function homeSections(
  sections: readonly StoreLayoutSection[],
  t: Translate
): Promise<HomeSectionView[]> {
  const views = await Promise.all(sections.map((section) => sectionView(section, t)))
  return views.flatMap((view) => (view ? [view] : []))
}
