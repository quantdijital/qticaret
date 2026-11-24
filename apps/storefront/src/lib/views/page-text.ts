import "server-only"
import type {
  StoreContactSection,
  StoreContentPageSection,
  StoreFactsSection,
  StoreFaqSection,
  StoreRichTextSection,
} from "@qticaret/types"
import { faqSettingsOf } from "@qticaret/types/section-faq"
import { contactSwitchOf } from "@qticaret/types/section-pages"
import { pageTextSwitchOf } from "@qticaret/types/section-rich-text"
import type { ContactFormView, PageTextSectionView, Translate } from "@qticaret/ui"
import { currentCustomer } from "@/lib/account/auth"
import { legalIdentity } from "@/lib/store-api/requests"
import { identityRows } from "./content-extras"
import { faqOf, faqOfRows } from "./faq"
import { legalDocument, legalPath } from "./legal"
import { withOutline } from "./legal-outline"
import { paymentFacts, shippingFacts } from "./page-facts"
import { withPictures } from "./prose-images"
import { contactOf } from "./shop"

/**
 * A content page's own text sections as the theme draws them (adr/0073
 * Ek 2026-11-19 (2) K2, K8), read at each request as the page's text and
 * its role's parts were before they were sections: the backend's HTML
 * with its library pictures in their versions, a text of questions read
 * into its groups or a long text's contents, the contact page's form
 * (a signed-in customer's name and address filled in here, never in the
 * backend's cached answer), ways to reach the shop and imprint, the live
 * payment and shipping facts.
 */

/** A page's article as the store read gives it. */
export type StorePageArticle = StoreRichTextSection & { variant: "article" }

/** A page's questions page (`faq` as `page`, adr/0073 Ek 2026-11-24 (2)) as the store read gives it. */
export type StorePageFaq = StoreFaqSection & { variant: "page" }

/** A page's own text section as the store read gives it. */
export type StorePageText =
  StorePageArticle | StorePageFaq | StoreContactSection | StoreFactsSection

/** Whether a page's section is one of its own text sections. */
export const isStorePageText = (section: StoreContentPageSection): section is StorePageText =>
  section.type === "contact" ||
  section.type === "payment_facts" ||
  section.type === "shipping_facts" ||
  (section.type === "rich_text" && section.variant === "article") ||
  (section.type === "faq" && section.variant === "page")

// `kvkk`: a guest's data request (adr/0047 Ek 2026-11-02); a customer asks from the account too
const SUBJECTS = ["order", "product", "return", "payment", "kvkk", "other"] as const

/** Where a text's pictures stand: the opening one loads at once (`withPictures`). */
interface TextPlace {
  /** The section opens the page with no cover above it. */
  opens: boolean
  /**
   * The page's anchors so far (`pageAnchors`, then each text's in the
   * page's order): a heading's anchor never meets another on the page.
   */
  anchors: Set<string>
}

/**
 * The page's text (`article`): read as questions when it is one and the
 * shop left `questions` on, else its `h2`s anchored for a table of
 * contents when `outline` is on.
 */
async function articleView(
  section: StorePageArticle,
  t: Translate,
  place: TextPlace
): Promise<PageTextSectionView> {
  const html = withPictures(section.html, section.images, { cover: !place.opens })
  const head = {
    id: section.id,
    type: "rich_text",
    variant: "article",
    title: section.title,
  } as const
  // Read before any wait, so the page's texts take their anchors in its order
  const faq = pageTextSwitchOf(section.questions) === "auto" ? faqOf(html, place.anchors) : null
  if (faq) {
    return { ...head, html, outline: [], faq, help: contactOf(await legalIdentity(), t) }
  }
  const read =
    pageTextSwitchOf(section.outline) === "auto"
      ? withOutline(html, place.anchors)
      : { html, outline: [] }
  return { ...head, ...read, faq: null, help: null }
}

/**
 * The page's questions page: the shop's rows by group, their anchors in
 * the page's order as a text of questions took them, the ways to reach
 * the shop beside them; its switches as set.
 */
async function faqView(
  section: StorePageFaq,
  t: Translate,
  place: TextPlace
): Promise<PageTextSectionView | null> {
  // Read before any wait, so the page's texts take their anchors in its order
  const faq = faqOfRows(section.items, place.anchors)
  if (faq.groups.length === 0) {
    return null
  }
  return {
    id: section.id,
    type: "faq",
    variant: "page",
    title: section.title,
    faq,
    help: contactOf(await legalIdentity(), t),
    settings: faqSettingsOf(section),
  }
}

/** The contact page's body: its words, the ways to reach the shop, the form and the imprint as switched. */
async function contactView(
  section: StoreContactSection,
  t: Translate,
  place: TextPlace
): Promise<PageTextSectionView> {
  const formOn = contactSwitchOf(section.form) === "on"
  const [customer, notice, identity] = await Promise.all([
    formOn ? currentCustomer() : null,
    formOn ? legalDocument("privacy_notice") : null,
    legalIdentity(),
  ])
  const name = [customer?.first_name, customer?.last_name].filter(Boolean).join(" ")
  const form: ContactFormView | null = formOn
    ? {
        subjects: SUBJECTS.map((value) => ({ value, label: t(`contact.subjects.${value}`) })),
        name: name || null,
        email: customer?.email ?? null,
        privacyPath: notice ? legalPath("privacy_notice") : null,
      }
    : null
  return {
    id: section.id,
    type: "contact",
    html: withPictures(section.html, section.images, { cover: !place.opens }),
    form,
    contact: contactOf(identity, t),
    identity: contactSwitchOf(section.imprint) === "on" ? identityRows(identity, t) : [],
  }
}

/**
 * One of the page's text sections as the theme draws it; the payment or
 * shipping facts with nothing to show (or unanswered) left out.
 */
export async function pageTextView(
  section: StorePageText,
  t: Translate,
  place: TextPlace
): Promise<PageTextSectionView | null> {
  switch (section.type) {
    case "rich_text":
      return articleView(section, t, place)
    case "faq":
      return faqView(section, t, place)
    case "contact":
      return contactView(section, t, place)
    case "payment_facts": {
      const payments = await paymentFacts()
      return payments ? { id: section.id, type: "payment_facts", payments } : null
    }
    case "shipping_facts": {
      const shipping = await shippingFacts()
      return shipping ? { id: section.id, type: "shipping_facts", shipping } : null
    }
  }
}
