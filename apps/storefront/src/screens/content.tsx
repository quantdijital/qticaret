import type { Resolution } from "@qticaret/types"
import type { ContactFormView } from "@qticaret/ui"
import { sendContact } from "@/app/actions/contact"
import { currentCustomer } from "@/lib/account/auth"
import { t } from "@/lib/i18n"
import { legalDocument, legalPath } from "@/lib/views/legal"
import { JsonLd } from "@/lib/seo/JsonLd"
import { storefrontSettings } from "@/lib/store-api/requests"
import { storeGet } from "@/lib/store-api/server"
import { breadcrumbsOf } from "@/lib/views/product"
import { theme } from "@/theme"

type Entity = Extract<Resolution, { type: "entity" }>

interface ContentEntry {
  id: string
  title: string
  html: string
  published_at: string | null
}

const SUBJECTS = ["order", "product", "return", "payment", "other"] as const

/** The contact form, on the page the shop chose for it (adr/0047); null elsewhere. */
async function contactFormOf(page: Entity): Promise<ContactFormView | null> {
  const { storefront } = await storefrontSettings()
  if (page.entity_type !== "page" || storefront.contact_form_path !== page.path) {
    return null
  }
  const [customer, notice] = await Promise.all([currentCustomer(), legalDocument("privacy_notice")])
  const name = [customer?.first_name, customer?.last_name].filter(Boolean).join(" ")
  return {
    subjects: SUBJECTS.map((value) => ({ value, label: t(`contact.subjects.${value}`) })),
    name: name || null,
    email: customer?.email ?? null,
    privacyPath: notice ? legalPath("privacy_notice") : null,
  }
}

/** A content page or blog post (F3.16): the backend's sanitised HTML (adr/0019). */
export async function ContentScreen({ page }: { page: Entity }) {
  const [{ entry }, contactForm] = await Promise.all([
    storeGet<{ entry: ContentEntry }>(`/store/content/${encodeURIComponent(page.entity_id)}`),
    contactFormOf(page),
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
          contactForm,
        }}
      />
    </>
  )
}
