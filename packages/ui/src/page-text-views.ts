import type {
  ContactFormView,
  FaqView,
  HomeSectionView,
  IdentityRowView,
  OutlineItemView,
  PaymentFactsView,
  SectionDeviceView,
  SectionLookView,
  ShippingFactsView,
} from "./content-views"
import type { FaqSettings } from "@qticaret/types"
import type { ContactView } from "./views"

/**
 * A content page's own sections as a theme draws them (adr/0073 Ek
 * 2026-11-19 (2) K2, K8): the page's text, the contact page's body, the
 * live payment and shipping facts; in a page's one list beside the home
 * page's types (`ContentPageView.sections`).
 */

/** What every page text section carries beside its own fields, as `HomeSectionView` does. */
interface PageTextParts {
  id: string
  look?: SectionLookView
  device?: SectionDeviceView
  /** Only in the theme editor's live preview: the theme marks its fields (`fieldMark`). */
  editor?: true
}

/**
 * A content page's own text ("Sayfa metni", `rich_text` as `article`):
 * the backend's HTML in a reading measure, as the page drew its text
 * before it was a section.
 */
export interface PageArticleView extends PageTextParts {
  type: "rich_text"
  variant: "article"
  /** The section's own heading, an h2 above the text; null: none. */
  title: string | null
  /** The backend's own HTML (adr/0019), its `h2`s carrying the outline's ids. */
  html: string
  /** The text's `h2`s for a table of contents beside a long text; none with `outline: off`. */
  outline: OutlineItemView[]
  /**
   * A text of questions read into its groups (each question a bold line
   * or a heading ending in "?", under its group's heading); null: an
   * ordinary text, or `questions: off`. `html` stays the whole text.
   */
  faq: FaqView | null
  /** The ways to reach the shop beside its questions; null without `faq`. */
  help: ContactView | null
}

/**
 * A content page's questions page ("Sayfa SSS'si", `faq` as `page`, adr/0073
 * Ek 2026-11-24 (2)): the shop's own questions and answers drawn as a text
 * of questions was before (`PageArticleView.faq`), the groups by their
 * headings, the ways to reach the shop beside them.
 */
export interface PageFaqView extends PageTextParts {
  type: "faq"
  variant: "page"
  /** The section's own heading, an h2 above the questions; null: none. */
  title: string | null
  /** The questions by group; `intro` and each group's `lead` empty (an FAQ holds rows only). */
  faq: FaqView
  /** The ways to reach the shop beside the questions. */
  help: ContactView | null
  /** The first question open, one open at a time (bilesen-denetimi (b) 8); absent: off. */
  settings?: FaqSettings
}

/**
 * The contact page's body as a section ("İletişim", adr/0047, adr/0048):
 * its own words, how to reach the shop, the form and the imprint, each as
 * the shop switched it; at most one on a page (its anchors are the page's).
 */
export interface PageContactView extends PageTextParts {
  type: "contact"
  /** The section's own words, the backend's HTML (adr/0019); "" for none. */
  html: string
  /** The contact form, a signed-in customer's name and address filled in; null: switched off. */
  form: ContactFormView | null
  /** How to reach the shop, from its store details. */
  contact: ContactView | null
  /** The shop's imprint (künye) in words; none: switched off, or nothing set. */
  identity: IdentityRowView[]
}

/** "Ödeme seçenekleri": the ways to pay the shop offers now and its card families' rates. */
export interface PagePaymentFactsView extends PageTextParts {
  type: "payment_facts"
  payments: PaymentFactsView
}

/** "Kargo bilgileri": the carriers the shop connected and its own promises. */
export interface PageShippingFactsView extends PageTextParts {
  type: "shipping_facts"
  shipping: ShippingFactsView
}

/**
 * The sections only a content page takes, its own text among them. A
 * theme draws them as the page drew its text before they were sections:
 * the facts right after an `article` beside it.
 */
export type PageTextSectionView =
  PageArticleView | PageFaqView | PageContactView | PagePaymentFactsView | PageShippingFactsView

/** A content page's section: one of the page's own, or one of the home page's types. */
export type ContentPageSectionView = HomeSectionView | PageTextSectionView
