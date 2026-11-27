import type {
  AnnouncementBar,
  BodySection,
  BodySectionType,
  CategorySection,
  FaqSection,
  FooterNewsletter,
  HeaderMarquee,
  HomeSection,
  HomeSectionType,
  PageGroup,
  Placement,
  RichTextSection,
} from "@/features/storefront/api/layout"
import type { JSONContent } from "@tiptap/react"
import type { PageTextSwitch } from "@qticaret/types"
import { newQuestion } from "./faq-rows"
import {
  ANNOUNCEMENT_DEFAULTS,
  BANNER_DEFAULTS,
  MARQUEE_DEFAULTS,
  PHOTO_COLLAGE_DEFAULTS,
  STATS_DEFAULTS,
  STEPS_DEFAULTS,
  DEPARTURES_DEFAULTS,
  DEPARTURES_LIMITS,
  SLIDER_DEFAULTS,
  STRIP_GALLERY_DEFAULTS,
  defaultVariant,
} from "@qticaret/types"
import { PRICE_BANDS_LIMITS } from "@/features/storefront/api/layout"

/**
 * The sections the editor adds (adr/0049): each in the storefront's own
 * words until the shop writes its own (`sections.ts` re-exports them).
 */

const ALWAYS = { visible: true, starts_at: null, ends_at: null } as const

const emptyBody = (): JSONContent => ({ type: "doc", content: [] })

/** A section as the chooser adds it: the storefront's own words until the shop writes its own. */
export function newHomeSection(type: HomeSectionType, id: string): HomeSection {
  const base = { id, ...ALWAYS }
  switch (type) {
    case "faq":
      // adr/0073 Ek 2026-11-24 (2): one question to write, its answer a short rich text
      return { ...base, type, title: null, items: [newQuestion()], variant: defaultVariant(type) }
    case "hero":
      return {
        ...base,
        type,
        variant: defaultVariant(type),
        eyebrow: null,
        heading: null,
        text: null,
        links: [],
        image: null,
      }
    case "price_bands":
      return { ...base, type, ...newPriceBands() }
    case "hero_slider":
      return {
        ...base,
        type,
        slides: [],
        height: "regular",
        scroller: SLIDER_DEFAULTS,
      }
    case "banner":
      return { ...base, type, slides: [], ...BANNER_DEFAULTS, variant: defaultVariant(type) }
    case "strip_gallery":
      // No strip yet: the shop adds two to eight, each from a record or its own picture
      return { ...base, type, title: null, text: null, items: [], ...STRIP_GALLERY_DEFAULTS }
    case "categories":
      return {
        ...base,
        type,
        title: null,
        category_ids: [],
        show_count: false,
        more: null,
        variant: defaultVariant(type),
      }
    case "products":
      return {
        ...base,
        type,
        title: null,
        variant: "grid",
        source: { kind: "newest" },
        limit: 12,
        columns: 3,
        more: { kind: "system", target: "shop", label: null },
      }
    case "featured_product":
      return { ...base, type, title: null, text: null, product_id: "" }
    case "brands":
      return { ...base, type, title: null, brand_ids: [] }
    case "posts":
      return { ...base, type, title: null, limit: 3, variant: defaultVariant(type) }
    case "reviews":
      return { ...base, type, title: null, limit: 6, variant: "grid" }
    case "rich_text":
      return {
        ...base,
        type,
        title: null,
        body: { type: "doc", content: [] },
        variant: defaultVariant(type),
      }
    case "trust_badges":
      return { ...base, type, variant: defaultVariant(type) }
    case "marquee":
      return { ...base, ...newMarqueeFields() }
    case "newsletter":
      return {
        ...base,
        type,
        title: null,
        text: null,
        variant: defaultVariant(type),
        description: null,
      }
    case "help":
      return { ...base, type, title: null, text: null }
    // The box itself is the theme's (adr/0077 §1): only a heading and an intro to write
    case "search_box":
      return { ...base, type, title: null, intro: null }
    // Three figures and three steps to write (adr/0077 §10): a row as most shops fill it
    case "stats":
      return {
        ...base,
        type,
        title: null,
        items: [0, 1, 2].map(() => ({ value: "", label: "", text: null })),
        ...STATS_DEFAULTS,
      }
    case "steps":
      return {
        ...base,
        type,
        title: null,
        intro: null,
        items: [0, 1, 2].map(() => ({ title: "", text: null })),
        link: null,
        ...STEPS_DEFAULTS,
      }
    // Five photographs to choose (adr/0077 §10): the first large beside four, a full mosaic
    case "photo_collage":
      return {
        ...base,
        type,
        title: null,
        intro: null,
        items: [0, 1, 2, 3, 4].map(() => ({ image: null, caption: null, link: null })),
        ...PHOTO_COLLAGE_DEFAULTS,
      }
    // Every dated product's nearest departures, as a list (adr/0077 §10)
    case "departures":
      return {
        ...base,
        type,
        title: null,
        intro: null,
        source: { kind: "all" },
        limit: DEPARTURES_LIMITS.limit.default,
        ...DEPARTURES_DEFAULTS,
      }
  }
}

/**
 * A section of a page body as its chooser adds it; a category page's goes
 * where it was added (below the products unless said otherwise). A content
 * page's sections are one list (adr/0073 Ek 2026-11-19 (2) K1): no place.
 */
export function newBodySection(
  group: PageGroup,
  type: BodySectionType,
  id: string,
  placement: Placement = "bottom"
): BodySection {
  const base = { id, ...ALWAYS }
  if (type === "related_products") {
    return {
      ...base,
      type,
      title: null,
      variant: "grid",
      source: { kind: "same_category" },
      limit: 8,
      columns: 3,
    }
  }
  if (type === "program") {
    // adr/0078: the steps are the product's; the section only says how they are drawn
    return { ...base, type, title: null, variant: "timeline" }
  }
  if (type === "contact") {
    // The contact page's body: its text beside the form, the imprint below (K2)
    return { ...base, type, body: emptyBody(), form: "on", imprint: "on" }
  }
  if (type === "payment_facts" || type === "shipping_facts") {
    return { ...base, type }
  }
  const section = newHomeSection(type, id)
  return group === "category" ? ({ ...section, placement } as CategorySection) : section
}

/**
 * A content page's own text (K2, "Sayfa metni"): its outline as before. A
 * new text is never read as questions (adr/0073 Ek 2026-11-24 (2): the
 * shop's questions are an FAQ's rows); a page's text shown as the
 * storefront draws it (`page-synth.ts`) keeps `auto`, as the backend's
 * synthesis does.
 */
export const newPageText = (
  id: string,
  body: JSONContent = emptyBody(),
  questions: PageTextSwitch = "off"
): RichTextSection => ({
  id,
  ...ALWAYS,
  type: "rich_text",
  title: null,
  body,
  variant: "article",
  outline: "auto",
  questions,
})

/** A content page's questions page ("Sayfa SSS'si"): one question to write. */
export const newPageFaq = (id: string): FaqSection => ({
  id,
  ...ALWAYS,
  type: "faq",
  title: null,
  items: [newQuestion()],
  variant: "page",
})

/**
 * A new price bands strip's fields: three bands to start from, each an
 * upper bound in whole lira, the last without one ("and up"), and a label
 * to write (the form suggests one from the bound, as a strip's first
 * item); the contract's default products shown small.
 */
const newPriceBands = () => ({
  title: null,
  bands: [
    { label: "", text: null, max: 500, category_id: null },
    { label: "", text: null, max: 1000, category_id: null },
    { label: "", text: null, max: null, category_id: null },
  ],
  thumbs: PRICE_BANDS_LIMITS.thumbs.default,
})

/** The announcement bar, with one line to write. */
export const newAnnouncementBar = (id: string): AnnouncementBar => ({
  id,
  ...ALWAYS,
  type: "announcement_bar",
  lines: [""],
  ...ANNOUNCEMENT_DEFAULTS,
})

/** A new scrolling strip's fields: one item to write, the contract's default steps. */
const newMarqueeFields = () => ({
  type: "marquee" as const,
  items: [{ icon: null, text: "", subtext: null, link: null }],
  ...MARQUEE_DEFAULTS,
})

/** The header group's scrolling strip, above the shop's header (adr/0049 Ek 2026-11-14 §10 karar 9). */
export const newHeaderMarquee = (id: string): HeaderMarquee => ({
  id,
  ...ALWAYS,
  ...newMarqueeFields(),
})

/** The footer's newsletter box, in the storefront's own words. */
export const newFooterNewsletter = (id: string): FooterNewsletter => ({
  id,
  ...ALWAYS,
  type: "newsletter",
  title: null,
  text: null,
  variant: "standard",
  description: null,
})
