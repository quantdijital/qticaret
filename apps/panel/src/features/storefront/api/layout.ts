import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import type { ProductSource, ShelfColumns } from "@qticaret/types"
import type { JSONContent } from "@tiptap/react"
import type { LinkInput } from "@/features/storefront/api/menus"
import { sdk } from "@/lib/sdk"

/**
 * The theme editor's document (adr/0049, backend lib/storefront/layout.ts):
 * the header's, the home page's, every product and category page's and
 * the footer's sections, saved whole as a draft and published together.
 */

/** The server's limits, so a mistake shows before the save. */
export const LAYOUT_LIMITS = {
  home: 30,
  product: 12,
  category: 12,
  faq: 12,
  related: 12,
  question: 160,
  answer: 600,
  items: 24,
  slides: 6,
  lines: 5,
  line: 120,
  title: 60,
  eyebrow: 40,
  heading: 90,
  text: 240,
  slideText: 160,
  alt: 300,
  label: 60,
  heroLinks: 2,
  posts: 6,
  reviews: 12,
} as const

/** A hero slider's slides and seconds a slide stays while it plays (adr/0049 Ek 2026-11-06). */
export const SLIDER_LIMITS = {
  slides: { min: 2, max: 6 },
  interval: { min: 5, max: 10, default: 6 },
} as const

/** A best-seller rail's window in days (adr/0049 Ek 2026-11-05): a week to a year, 90 by default. */
export const BEST_SELLER_DAYS = { min: 7, max: 365, default: 90 } as const

/** A product rail's cards in a row on a wide screen (adr/0049 Ek 2026-11-05); 3 by default. */
export const SHELF_COLUMNS: readonly ShelfColumns[] = [3, 4, 5]

/** A button's or a slide's target: the menus' link (a record, a legal text, a page or an address). */
export type LayoutLink = LinkInput
export type { ProductSource, ShelfColumns }

export interface LayoutImage {
  url: string
  alt: string | null
}

interface SectionBase {
  /** The editor's own id (`^[a-z0-9]{6,24}$`), stable while the section moves. */
  id: string
  visible: boolean
  /** Shown only from, and until, these moments (ISO-8601 with an offset); none: always. */
  starts_at: string | null
  ends_at: string | null
}

export interface HeroSection extends SectionBase {
  type: "hero"
  eyebrow: string | null
  /** None: the shop's name. */
  heading: string | null
  text: string | null
  links: LayoutLink[]
  image: LayoutImage | null
}

/** One slide of the home page's sliding opening. */
export interface HeroSlide {
  image: LayoutImage
  /** A phone's own picture (a closer crop); none: the wide one. */
  mobile_image: LayoutImage | null
  heading: string | null
  text: string | null
  /** The slide's one action. */
  link: LayoutLink | null
  position: "left" | "center" | "right"
  /** `light`: light words on a dark picture; `dark`: dark words on a light one. */
  tone: "light" | "dark"
}

/** The home page's sliding opening (adr/0049 Ek 2026-11-06), an extra to the still hero. */
export interface HeroSliderSection extends SectionBase {
  type: "hero_slider"
  slides: HeroSlide[]
  height: "compact" | "regular"
  /** Off by default: nothing moves by itself unless the shop turns it on. */
  autoplay: boolean
  /** Seconds a slide stays while it plays (5–10). */
  interval: number
  dots: boolean
  arrows: boolean
}

export interface BannerSlide {
  image: LayoutImage
  heading: string | null
  text: string | null
  link: LayoutLink | null
}

export interface BannerSection extends SectionBase {
  type: "banner"
  slides: BannerSlide[]
}

export interface CategoriesSection extends SectionBase {
  type: "categories"
  title: string | null
  /** None: the top categories. */
  category_ids: string[]
}

export interface ProductsSection extends SectionBase {
  type: "products"
  title: string | null
  source: ProductSource
  limit: number
  /** Cards in a row on a wide screen; the theme steps down on narrower ones. */
  columns: ShelfColumns
  /** A "see all" link under the rail. */
  more: LayoutLink | null
}

/** One product up close (adr/0046 Ek 2026-11-05): the storefront adds its facts and spec table. */
export interface FeaturedProductSection extends SectionBase {
  type: "featured_product"
  title: string | null
  /** A line about it; may hold the shop's details (`{telefon}`). */
  text: string | null
  /** Empty: none chosen yet (the save waits for one). */
  product_id: string
}

export interface BrandsSection extends SectionBase {
  type: "brands"
  title: string | null
  /** None: every brand. */
  brand_ids: string[]
}

export interface CountedSection extends SectionBase {
  type: "posts" | "reviews"
  title: string | null
  limit: number
}

export interface RichTextSection extends SectionBase {
  type: "rich_text"
  title: string | null
  /** The content editor's document (adr/0019). */
  body: JSONContent
}

export interface TrustBadgesSection extends SectionBase {
  type: "trust_badges"
}

export interface WordedSection extends SectionBase {
  type: "newsletter" | "help"
  title: string | null
  text: string | null
}

export interface FaqItem {
  /** Plain text. */
  question: string
  /** Plain text; may hold the shop's details (`{telefon}`). */
  answer: string
}

/** Questions and answers; the storefront also gives them as `FAQPage` structured data. */
export interface FaqSection extends SectionBase {
  type: "faq"
  title: string | null
  items: FaqItem[]
}

/** Products under a product's own: its category's (the storefront finds it), a collection's or chosen ones. */
export type RelatedSource =
  | { kind: "same_category" }
  | { kind: "collection"; collection_id: string }
  | { kind: "manual"; product_ids: string[] }

export interface RelatedProductsSection extends SectionBase {
  type: "related_products"
  title: string | null
  source: RelatedSource
  limit: number
  columns: ShelfColumns
}

export type HomeSection =
  | HeroSection
  | HeroSliderSection
  | BannerSection
  | CategoriesSection
  | ProductsSection
  | FeaturedProductSection
  | BrandsSection
  | CountedSection
  | RichTextSection
  | TrustBadgesSection
  | WordedSection
  | FaqSection

export type HomeSectionType = HomeSection["type"]

/** Under the product's own block, on every product page. */
export type ProductSection =
  | RelatedProductsSection
  | RichTextSection
  | BannerSection
  | FaqSection
  | TrustBadgesSection
  | WordedSection

/** Where a category page shows a section: above its product grid or below it. */
export type Placement = "top" | "bottom"

/** On every category page, above or below the products. */
export type CategorySection = (
  RichTextSection | BannerSection | FaqSection | TrustBadgesSection | WordedSection
) & { placement: Placement }

export interface AnnouncementBar extends SectionBase {
  type: "announcement_bar"
  lines: string[]
}

export interface FooterNewsletter extends SectionBase {
  type: "newsletter"
  title: string | null
  text: string | null
}

export interface LayoutDocument {
  header: AnnouncementBar[]
  home: HomeSection[]
  footer: FooterNewsletter[]
  product: ProductSection[]
  category: CategorySection[]
}

export type LayoutGroup = keyof LayoutDocument
/** The groups that make a page's body: sections are added, moved and copied in them. */
export type BodyGroup = "home" | "product" | "category"
export type BodySection = HomeSection | ProductSection | CategorySection
export type BodySectionType = BodySection["type"]
export type AnySection = AnnouncementBar | BodySection | FooterNewsletter

export interface LayoutRevision {
  revision: number
  published_at: string
  published_by: string | null
}

export interface AdminLayout {
  draft: LayoutDocument
  /** Never saved: the draft is the default design (the storefront as it was built). */
  is_default: boolean
  /** The draft differs from what is live. */
  has_changes: boolean
  revision: number
  published_at: string | null
  /** Newest first. */
  revisions: LayoutRevision[]
}

/** A signed link to the draft as saved now; a later save ends it. */
export interface LayoutPreview {
  url: string
  path: string
  expires_at: string
}

const PATH = "/admin/storefront-layout"
export const LAYOUT_KEY = ["storefront-layout"] as const
/** Publish, discard and restore: the autosave waits while one runs. */
export const LAYOUT_ACTION_KEY = [...LAYOUT_KEY, "action"] as const

/** The layout as the server answers; an older backend may leave the page groups out. */
interface Answer {
  layout: Omit<AdminLayout, "draft"> & {
    draft: Omit<LayoutDocument, "product" | "category"> &
      Partial<Pick<LayoutDocument, "product" | "category">>
  }
}

/** A draft from before the product and category pages had sections reads with both empty. */
const withAllGroups = (layout: Answer["layout"]): AdminLayout => ({
  ...layout,
  draft: {
    ...layout.draft,
    product: layout.draft.product ?? [],
    category: layout.draft.category ?? [],
  },
})

export const layoutQuery = () =>
  queryOptions({
    queryKey: LAYOUT_KEY,
    queryFn: async () => withAllGroups((await sdk.client.fetch<Answer>(PATH)).layout),
    // The editor holds its own copy once open; a refetch would not change it
    staleTime: Infinity,
  })

/** Each change answers with the layout as stored: it replaces the cache at once. */
function useLayoutAction<T>(call: (input: T) => Promise<Answer>, action = true) {
  const client = useQueryClient()
  return useMutation({
    mutationKey: action ? LAYOUT_ACTION_KEY : [...LAYOUT_KEY, "save"],
    mutationFn: async (input: T) => withAllGroups((await call(input)).layout),
    onSuccess: (layout) => {
      client.setQueryData(LAYOUT_KEY, layout)
    },
  })
}

const post = (path: string, body: object = {}) =>
  sdk.client.fetch<Answer>(path, { method: "POST", body })

/** The draft saved whole; nothing reaches shoppers until it is published. */
export const useSaveLayout = () =>
  useLayoutAction((document: LayoutDocument) => post(PATH, { document }), false)

export const usePublishLayout = () => useLayoutAction(() => post(`${PATH}/publish`))

/** The draft back to what is live (or the default design). */
export const useDiscardLayout = () => useLayoutAction(() => post(`${PATH}/discard`))

/** A published revision back into the draft. */
export const useRestoreRevision = () =>
  useLayoutAction((revision: number) =>
    post(`${PATH}/revisions/${encodeURIComponent(String(revision))}/restore`)
  )

/** A fresh link to the draft as saved now. */
export const fetchLayoutPreview = () =>
  sdk.client.fetch<LayoutPreview>(`${PATH}/preview`, { method: "POST", body: {} })
