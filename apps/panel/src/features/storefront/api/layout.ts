import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import type { ProductSource } from "@qticaret/types"
import type { JSONContent } from "@tiptap/react"
import type { LinkInput } from "@/features/storefront/api/menus"
import { sdk } from "@/lib/sdk"

/**
 * The theme editor's document (adr/0049, backend lib/storefront/layout.ts):
 * the header's, the home page's and the footer's sections, saved whole as
 * a draft and published together.
 */

/** The server's limits, so a mistake shows before the save. */
export const LAYOUT_LIMITS = {
  home: 30,
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

/** A button's or a slide's target: the menus' link (a record, a legal text, a page or an address). */
export type LayoutLink = LinkInput
export type { ProductSource }

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
  /** A "see all" link under the rail. */
  more: LayoutLink | null
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

export type HomeSection =
  | HeroSection
  | BannerSection
  | CategoriesSection
  | ProductsSection
  | BrandsSection
  | CountedSection
  | RichTextSection
  | TrustBadgesSection
  | WordedSection

export type HomeSectionType = HomeSection["type"]

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
}

export type LayoutGroup = keyof LayoutDocument
export type AnySection = AnnouncementBar | HomeSection | FooterNewsletter

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

interface Answer {
  layout: AdminLayout
}

export const layoutQuery = () =>
  queryOptions({
    queryKey: LAYOUT_KEY,
    queryFn: async () => (await sdk.client.fetch<Answer>(PATH)).layout,
    // The editor holds its own copy once open; a refetch would not change it
    staleTime: Infinity,
  })

/** Each change answers with the layout as stored: it replaces the cache at once. */
function useLayoutAction<T>(call: (input: T) => Promise<Answer>, action = true) {
  const client = useQueryClient()
  return useMutation({
    mutationKey: action ? LAYOUT_ACTION_KEY : [...LAYOUT_KEY, "save"],
    mutationFn: async (input: T) => (await call(input)).layout,
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
