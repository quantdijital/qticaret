import type { Resolution } from "@qticaret/types"
import type { ContactFormView, ContactView, ContentPageView, IdentityRowView } from "@qticaret/ui"
import { addToCart } from "@/app/actions/cart"
import { sendContact } from "@/app/actions/contact"
import { subscribeNewsletter } from "@/app/actions/newsletter"
import { currentCustomer } from "@/lib/account/auth"
import { t } from "@/lib/i18n"
import { legalDocument, legalPath } from "@/lib/views/legal"
import { JsonLd } from "@/lib/seo/JsonLd"
import { legalIdentity, storefrontSettings } from "@/lib/store-api/requests"
import { authorView } from "@/lib/views/authors"
import type { ContentEntry } from "@/lib/store-api/content-entry"
import { storeGet } from "@/lib/store-api/server"
import { isStoreApiError } from "@/lib/store-api/errors"
import { identityRows, postMeta, shareLinks } from "@/lib/views/content-extras"
import { infoPageOf, isContactPage } from "@/lib/views/page-roles"
import type { RolePage } from "@/lib/views/page-roles"
import { faqOf } from "@/lib/views/faq"
import { withOutline } from "@/lib/views/legal-outline"
import { contentSections } from "@/lib/views/page-sections"
import { coverOf, postTerms } from "@/lib/views/posts"
import { withPictures } from "@/lib/views/prose-images"
import { breadcrumbsOf } from "@/lib/views/product"
import { contactOf } from "@/lib/views/shop"
import { theme } from "@/theme"
import { paymentFacts, relatedPosts, shippingFacts, textProducts } from "./content-data"

type Entity = Extract<Resolution, { type: "entity" }>

// `kvkk`: a guest's data request (adr/0047 Ek 2026-11-02); a customer asks from the account too
const SUBJECTS = ["order", "product", "return", "payment", "kvkk", "other"] as const

/**
 * On the page the shop chose for it (adr/0047): how to reach the shop, from
 * its store details (adr/0048), its imprint, and the contact form; nothing
 * elsewhere.
 */
async function contactOfPage(page: Entity): Promise<{
  form: ContactFormView
  contact: ContactView
  identity: IdentityRowView[]
} | null> {
  const { storefront } = await storefrontSettings()
  // By the page's id: a page whose address changed keeps the form (adr/0073 Açık kararlar 3)
  if (
    page.entity_type !== "page" ||
    !isContactPage({ id: page.entity_id, path: page.path }, storefront)
  ) {
    return null
  }
  const [customer, notice, identity] = await Promise.all([
    currentCustomer(),
    legalDocument("privacy_notice"),
    legalIdentity(),
  ])
  const name = [customer?.first_name, customer?.last_name].filter(Boolean).join(" ")
  return {
    form: {
      subjects: SUBJECTS.map((value) => ({ value, label: t(`contact.subjects.${value}`) })),
      name: name || null,
      email: customer?.email ?? null,
      privacyPath: notice ? legalPath("privacy_notice") : null,
    },
    contact: contactOf(identity, t),
    identity: identityRows(identity, t),
  }
}

/**
 * A page's own extras (adr/0046 Ek 2026-11-05, içerik sayfaları): a text
 * of questions as its groups with the ways to reach the shop beside them,
 * the payment page's ways to pay and installment rates, the shipping
 * page's carriers and promises; else its headings for a table of contents.
 */
async function pageExtras(entry: ContentEntry, page: RolePage): Promise<Partial<ContentPageView>> {
  const faq = faqOf(entry.html)
  if (faq) {
    return { faq, help: contactOf(await legalIdentity(), t) }
  }
  // The pages the shop chose for these (adr/0046 Ek 2026-11-05); unanswered, none
  const frame = await storefrontSettings()
    .then((answer) => answer.storefront)
    .catch((error: unknown) => {
      if (isStoreApiError(error)) {
        return { payment_page_id: null, shipping_page_id: null }
      }
      throw error
    })
  const role = infoPageOf(page, frame)
  const [payments, shipping] = await Promise.all([
    role === "payments" ? paymentFacts() : null,
    role === "shipping" ? shippingFacts() : null,
  ])
  return { ...withOutline(entry.html), payments, shipping }
}

/**
 * A post's extras: its facts, a table of contents, its products, posts to
 * read next, share links, and its author's box (adr/0060).
 */
async function postExtras(entry: ContentEntry, page: Entity): Promise<Partial<ContentPageView>> {
  const [products, related] = await Promise.all([textProducts(entry.html), relatedPosts(entry)])
  return {
    ...withOutline(entry.html),
    post: postMeta(entry, t),
    author: entry.author ? authorView(entry.author, t) : null,
    products,
    related,
    share: shareLinks(page.seo?.canonical ?? null, entry.title, t),
  }
}

/**
 * A content page or blog post (F3.16): the backend's sanitised HTML
 * (adr/0019), a post's category and tags; a page with its own sections
 * from the theme editor (adr/0073), read beside it. `entry`: the page
 * already read (the theme editor's live session's page in draft).
 */
export async function ContentScreen({
  page,
  entry: given,
}: {
  page: Entity
  entry?: ContentEntry
}) {
  const [read, contact, sections] = await Promise.all([
    given ??
      storeGet<{ entry: ContentEntry }>(
        `/store/content/${encodeURIComponent(page.entity_id)}`
      ).then((answer) => answer.entry),
    contactOfPage(page),
    // A post takes no layout (adr/0073 §6)
    page.entity_type === "page" ? contentSections(page.entity_id, t) : undefined,
  ])
  // The text's library pictures in their versions; the opening one eager without a cover above it
  const entry = {
    ...read,
    html: withPictures(read.html, read.images, { cover: Boolean(read.image_url) }),
  }
  const extras =
    entry.kind === "post"
      ? await postExtras(entry, page)
      : await pageExtras(entry, { id: page.entity_id, path: page.path })
  return (
    <>
      <JsonLd blocks={page.seo?.jsonLd ?? []} />
      <theme.ContentPage
        t={t}
        actions={{ sendContact }}
        subscribe={subscribeNewsletter}
        // As on the home page: a one-variant card says "Sepete ekle"
        quickAdd={addToCart}
        view={{
          title: entry.title,
          html: entry.html,
          publishedAt: entry.published_at,
          breadcrumbs: breadcrumbsOf(page.seo, t("home.label"), entry.title),
          contactForm: contact?.form ?? null,
          contact: contact?.contact ?? null,
          ...postTerms(entry),
          image: coverOf(entry),
          ...(contact ? { identity: contact.identity } : {}),
          ...extras,
          ...(sections ? { sections } : {}),
        }}
      />
    </>
  )
}
