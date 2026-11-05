/**
 * The storefront's design as `GET /store/storefront-layout` gives it
 * (adr/0049): the sections showing now, links and images resolved, the
 * shop's details in place. A copy of the backend's answer (adr/0046 §8).
 */
import type { MediaDerivatives } from "./catalog.js"
import type { MenuLinkKind } from "./storefront.js"

export interface StoreLayoutLink {
  /** The shop's wording, else the record's name; null: the storefront's own name. */
  label: string | null
  kind: MenuLinkKind
  target: string | null
  /** The record's live path or the address; null: a storefront page or a legal text. */
  path: string | null
}

export interface StoreLayoutImage {
  url: string
  alt: string | null
  width: number | null
  height: number | null
  derivatives: MediaDerivatives | null
}

export type ProductSource =
  | { kind: "newest" }
  | { kind: "category"; category_id: string }
  | { kind: "collection"; collection_id: string }
  | { kind: "manual"; product_ids: string[] }

export type StoreLayoutSection =
  | {
      id: string
      type: "hero"
      eyebrow: string | null
      /** None: the shop's name. */
      heading: string | null
      text: string | null
      links: StoreLayoutLink[]
      image: StoreLayoutImage | null
    }
  | {
      id: string
      type: "banner"
      slides: {
        image: StoreLayoutImage
        heading: string | null
        text: string | null
        link: StoreLayoutLink | null
      }[]
    }
  | { id: string; type: "categories"; title: string | null; category_ids: string[] }
  | {
      id: string
      type: "products"
      title: string | null
      source: ProductSource
      limit: number
      more: StoreLayoutLink | null
    }
  | StoreFeaturedProductSection
  | { id: string; type: "brands"; title: string | null; brand_ids: string[] }
  | { id: string; type: "posts" | "reviews"; title: string | null; limit: number }
  | { id: string; type: "rich_text"; title: string | null; html: string }
  | { id: string; type: "trust_badges" }
  | { id: string; type: "newsletter" | "help"; title: string | null; text: string | null }
  | StoreFaqSection

/** One live product up close on the home page (adr/0046 Ek 2026-11-05); the storefront reads it. */
export interface StoreFeaturedProductSection {
  id: string
  type: "featured_product"
  title: string | null
  /** The shop's line about it, its `{tokens}` filled; null: none. */
  text: string | null
  product_id: string
}

/** Questions and answers in plain text, the answers' `{tokens}` already filled (adr/0049 Ek 2026-11-03). */
export interface StoreFaqSection {
  id: string
  type: "faq"
  title: string | null
  items: { question: string; answer: string }[]
}

/**
 * Where a product page's related rail takes its products from: the
 * product's own category (the storefront works it out), a collection, or
 * the shop's choice (only live products left in it).
 */
export type RelatedSource =
  | { kind: "same_category" }
  | { kind: "collection"; collection_id: string }
  | { kind: "manual"; product_ids: string[] }

/** The kinds every product and category page may hold (adr/0049 Ek 2026-11-03). */
export type StorePageSection = Extract<
  StoreLayoutSection,
  { type: "rich_text" | "banner" | "faq" | "trust_badges" | "help" | "newsletter" }
>

/** A section below every product's own block. */
export type StoreProductSection =
  | StorePageSection
  | {
      id: string
      type: "related_products"
      title: string | null
      source: RelatedSource
      limit: number
    }

/** A section of every category page: above the product grid (`top`) or below it. */
export type StoreCategorySection = StorePageSection & { placement: "top" | "bottom" }

export interface StoreLayout {
  header: { id: string; type: "announcement_bar"; lines: string[] }[]
  home: StoreLayoutSection[]
  footer: { id: string; type: "newsletter"; title: string | null; text: string | null }[]
  product: StoreProductSection[]
  category: StoreCategorySection[]
}
