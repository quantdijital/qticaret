import type { CategoryCardView, CustomerPhotoView } from "./card-views"
import type { FeaturedProductSectionView, ShopRatingView } from "./home-views"
import type { PaginationView } from "./listing-views"
import type { BreadcrumbView, ProductCardView, ReviewView } from "./product-views"
import type { ContactView, ImageView, LinkView, TrustBadgeView } from "./views"

/**
 * The home page, the blog and content pages as a theme shows them
 * (adr/0046 §7, adr/0049): their sections, posts, contact form and the
 * shop-wide reviews page.
 */

/**
 * A section as the theme draws it (adr/0049): the shop lays the home,
 * product and category pages out in the theme editor; every title already
 * in words (the shop's own or the storefront's default, a FAQ's aside),
 * every link already a path.
 */
export type HomeSectionView =
  | {
      id: string
      type: "hero"
      /** A short line above the heading; null: none. */
      eyebrow: string | null
      /** The shop's heading, else its name. */
      heading: string
      intro: string | null
      /** At most two buttons, the first the main one. */
      actions: LinkView[]
      image: ImageView | null
    }
  | {
      id: string
      type: "banner"
      slides: {
        image: ImageView
        heading: string | null
        text: string | null
        link: LinkView | null
      }[]
    }
  | { id: string; type: "categories"; title: string; categories: CategoryCardView[] }
  | {
      id: string
      type: "products"
      title: string
      products: ProductCardView[]
      more: LinkView | null
      /** Words when the rail has nothing to show. */
      empty: string
    }
  | FeaturedProductSectionView
  | { id: string; type: "brands"; title: string; brands: LinkView[] }
  | { id: string; type: "posts"; title: string; posts: PostCardView[]; more: LinkView }
  | {
      id: string
      type: "reviews"
      title: string
      reviews: (ReviewView & { product: LinkView | null })[]
      more: LinkView
      /** The newest customer photos on approved reviews (adr/0046 Ek 2026-11-04); none: no strip. */
      photos?: CustomerPhotoView[]
      /** The shop's average, count and stars' spread (adr/0046 Ek 2026-11-05); none: not drawn. */
      summary?: ShopRatingView | null
    }
  | { id: string; type: "rich_text"; title: string | null; html: string }
  | { id: string; type: "trust_badges"; badges: TrustBadgeView[] }
  | { id: string; type: "newsletter"; title: string; text: string; privacyPath: string | null }
  | { id: string; type: "help"; title: string; text: string; contact: ContactView }
  | {
      id: string
      type: "faq"
      /** None: the theme's own words ("Sık sorulan sorular"). */
      title: string | null
      /** Plain text; the theme keeps the answers in the HTML (open or closed). */
      items: { question: string; answer: string }[]
    }

export interface HomePageView {
  sections: HomeSectionView[]
  /** A line above the page: a draft's preview says it is one. */
  notice?: string | null
}

export interface PostCardView {
  title: string
  path: string
  excerpt: string
  image: ImageView | null
  /** "1 Kasım 2026", already in words; null for an undated post. */
  date: string | null
  /** The machine form for `<time datetime>`. */
  dateTime: string | null
  /** "5 dk okuma", already in words. */
  reading: string
  /** The post's category, at its archive (adr/0019 ek 2026-11-03); null when it has none. */
  category?: LinkView | null
}

/** A link in the blog's bar of categories: "all posts" first, then each category. */
export interface BlogTermLinkView extends LinkView {
  /** The page this is (the index, or this category's archive). */
  current: boolean
}

export interface BlogIndexPageView {
  title: string
  breadcrumbs: BreadcrumbView[]
  posts: PostCardView[]
  pagination: PaginationView
  /** The blog's categories with live posts; none: no bar. */
  terms?: BlogTermLinkView[]
  /** On a category's or tag's archive: which, and its own words; null on the index. */
  activeTerm?: { kind: "category" | "tag"; name: string; description: string[] } | null
}

export interface ContentPageView {
  title: string
  breadcrumbs: BreadcrumbView[]
  /** The backend's own HTML from its allow-listed schema (adr/0019): safe to print as it is. */
  html: string
  publishedAt: string | null
  /** The contact form below the text, on the page the shop chose for it (adr/0047). */
  contactForm?: ContactFormView | null
  /** How to reach the shop, from its store details, on that same page (adr/0048). */
  contact?: ContactView | null
  /** A line above the page, in words: a draft's preview says it is one. */
  notice?: string | null
  /** A post's category and tags, at their archives (adr/0019 ek 2026-11-03). */
  category?: LinkView | null
  tags?: LinkView[]
}

/** The storefront's contact form (adr/0047): a signed-in customer's name and address filled in. */
export interface ContactFormView {
  subjects: { value: string; label: string }[]
  name: string | null
  email: string | null
  /** The KVKK notice the form points to; null until the shop publishes one. */
  privacyPath: string | null
}

export interface ReviewsPageView {
  title: string
  breadcrumbs: BreadcrumbView[]
  average: number | null
  count: number
  /** The shop's reviews in short, shop-wide (adr/0046 Ek 2026-11-05); none: `average` and `count` only. */
  summary?: ShopRatingView | null
  reviews: (ReviewView & { product: LinkView | null })[]
  pagination: PaginationView
}
