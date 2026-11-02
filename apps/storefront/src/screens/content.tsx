import type { Resolution } from "@qticaret/types"
import type { ContactFormView, ContactView } from "@qticaret/ui"
import { sendContact } from "@/app/actions/contact"
import { currentCustomer } from "@/lib/account/auth"
import { t } from "@/lib/i18n"
import { legalDocument, legalPath } from "@/lib/views/legal"
import { JsonLd } from "@/lib/seo/JsonLd"
import { legalIdentity, storefrontSettings } from "@/lib/store-api/requests"
import { storeGet } from "@/lib/store-api/server"
import { breadcrumbsOf } from "@/lib/views/product"
import { contactOf } from "@/lib/views/shop"
import { theme } from "@/theme"

type Entity = Extract<Resolution, { type: "entity" }>

interface ContentEntry {
  id: string
  title: string
  html: string
  published_at: string | null
}

// `kvkk`: a guest's data request (adr/0047 Ek 2026-11-02); a customer asks from the account too
const SUBJECTS = ["order", "product", "return", "payment", "kvkk", "other"] as const

/**
 * On the page the shop chose for it (adr/0047): how to reach the shop, from
 * its store details (adr/0048), and the contact form; nothing elsewhere.
 */
async function contactOfPage(
  page: Entity
): Promise<{ form: ContactFormView; contact: ContactView } | null> {
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
  }
}

/** A content page or blog post (F3.16): the backend's sanitised HTML (adr/0019). */
export async function ContentScreen({ page }: { page: Entity }) {
  const [{ entry }, contact] = await Promise.all([
    storeGet<{ entry: ContentEntry }>(`/store/content/${encodeURIComponent(page.entity_id)}`),
    contactOfPage(page),
  ])
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
        }}
      />
    </>
  )
}
