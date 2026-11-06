import type {
  MediaDerivatives,
  Resolution,
  StoreContentAuthorDetail,
  StoreContentTerm,
} from "@qticaret/types"
import type { ContactFormView, ContactView, ContentPageView, IdentityRowView } from "@qticaret/ui"
import { sendContact } from "@/app/actions/contact"
import { currentCustomer } from "@/lib/account/auth"
import { t } from "@/lib/i18n"
import { legalDocument, legalPath } from "@/lib/views/legal"
import { JsonLd } from "@/lib/seo/JsonLd"
import { legalIdentity, storefrontSettings } from "@/lib/store-api/requests"
import { authorView } from "@/lib/views/authors"
import { storeGet } from "@/lib/store-api/server"
import { isStoreApiError } from "@/lib/store-api/errors"
import { identityRows, infoPageOf, postMeta, shareLinks } from "@/lib/views/content-extras"
import { faqOf } from "@/lib/views/faq"
import { withOutline } from "@/lib/views/legal-outline"
import { coverOf, postTerms } from "@/lib/views/posts"
import { breadcrumbsOf } from "@/lib/views/product"
import { contactOf } from "@/lib/views/shop"
import { theme } from "@/theme"
import { paymentFacts, relatedPosts, shippingFacts, textProducts } from "./content-data"

type Entity = Extract<Resolution, { type: "entity" }>

interface ContentEntry {
  id: string
  kind: "page" | "post"
  title: string
  html: string
  published_at: string | null
  image_url: string | null
  image_alt: string | null
  image_width?: number | null
  image_height?: number | null
  image_derivatives?: MediaDerivatives | null
  author_name: string | null
  /** The chosen author (adr/0060); null: none, the old written name alone if any. */
  author?: StoreContentAuthorDetail | null
  reading_minutes: number
  /** A post's, at their archives (adr/0019 ek 2026-11-03); a page has none. */
  category?: StoreContentTerm | null
  tags?: StoreContentTerm[]
}

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
  if (page.entity_type !== "page" || storefront.contact_form_path !== page.path) {
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
async function pageExtras(entry: ContentEntry, path: string): Promise<Partial<ContentPageView>> {
  const faq = faqOf(entry.html)
  if (faq) {
    return { faq, help: contactOf(await legalIdentity(), t) }
  }
  // The pages the shop chose for these (adr/0046 Ek 2026-11-05); unanswered, none
  const frame = await storefrontSettings()
    .then((answer) => answer.storefront)
    .catch((error: unknown) => {
      if (isStoreApiError(error)) {
        return { payment_info_path: null, shipping_info_path: null }
      }
      throw error
    })
  const role = infoPageOf(path, frame)
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

/** A content page or blog post (F3.16): the backend's sanitised HTML (adr/0019), a post's category and tags. */
export async function ContentScreen({ page }: { page: Entity }) {
  const [{ entry }, contact] = await Promise.all([
    storeGet<{ entry: ContentEntry }>(`/store/content/${encodeURIComponent(page.entity_id)}`),
    contactOfPage(page),
  ])
  const extras =
    entry.kind === "post" ? await postExtras(entry, page) : await pageExtras(entry, page.path)
  return (
    <>
      <JsonLd blocks={page.seo?.jsonLd ?? []} />
      <theme.ContentPage
        t={t}
        actions={{ sendContact }}
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
        }}
      />
    </>
  )
}
