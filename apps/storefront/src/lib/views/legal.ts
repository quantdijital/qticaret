import "server-only"
import { cache } from "react"
import type { LegalIdentity } from "@qticaret/types"
import type { Translate } from "@qticaret/ui"
import { isStoreApiError } from "@/lib/store-api/errors"
import { storePublicGet } from "@/lib/store-api/server"

/**
 * The shop's legal texts as pages of their own (F13.1, D10): one address
 * per kind under `/yasal`, the text as the backend renders it with the
 * shop's details filled in. A kind the shop has not published is a 404.
 */
export const LEGAL_PAGES = {
  "mesafeli-satis-sozlesmesi": "distance_sales",
  "on-bilgilendirme-formu": "pre_information",
  "kvkk-aydinlatma-metni": "privacy_notice",
  "cerez-politikasi": "cookie_policy",
  "iade-politikasi": "return_policy",
  "kargo-politikasi": "shipping_policy",
  "uyelik-sozlesmesi": "membership",
} as const

export type LegalSlug = keyof typeof LEGAL_PAGES

export const isLegalSlug = (value: string): value is LegalSlug => value in LEGAL_PAGES

export type LegalKind = (typeof LEGAL_PAGES)[LegalSlug]

export const isLegalKind = (value: string): value is LegalKind =>
  (Object.values(LEGAL_PAGES) as string[]).includes(value)

export const legalPath = (kind: (typeof LEGAL_PAGES)[LegalSlug]): string => {
  const slug = Object.entries(LEGAL_PAGES).find(([, each]) => each === kind)?.[0] ?? ""
  return `/yasal/${slug}`
}

export interface LegalDocument {
  kind: string
  version: number
  title: string
  html: string
  published_at: string | null
}

export const legalDocument = cache(async (kind: string): Promise<LegalDocument | null> => {
  try {
    const { document } = await storePublicGet<{ document: LegalDocument }>(`/store/legal/${kind}`)
    return document
  } catch (error) {
    if (isStoreApiError(error) && error.status === 404) {
      return null
    }
    throw error
  }
})

/** The published legal texts as footer links, in the order a shopper looks for them. */
export async function publishedLegalLinks(): Promise<{ label: string; path: string }[]> {
  const order: LegalSlug[] = [
    "mesafeli-satis-sozlesmesi",
    "on-bilgilendirme-formu",
    "iade-politikasi",
    "kargo-politikasi",
    "kvkk-aydinlatma-metni",
    "cerez-politikasi",
    "uyelik-sozlesmesi",
  ]
  const found = await Promise.all(order.map((slug) => legalDocument(LEGAL_PAGES[slug])))
  return order.flatMap((slug, index) => {
    const document = found[index]
    return document ? [{ label: document.title, path: `/yasal/${slug}` }] : []
  })
}

/** The shop's identity lines the e-commerce law asks for, those it filled in. */
export function identityLinesOf(identity: LegalIdentity, t: Translate): string[] {
  return [
    identity.mersis ? t("footer.mersis", { value: identity.mersis }) : null,
    identity.tax_office && identity.tax_number
      ? t("footer.tax", { office: identity.tax_office, number: identity.tax_number })
      : null,
    identity.kep ? t("footer.kep", { value: identity.kep }) : null,
    identity.etbis ? t("footer.etbis", { value: identity.etbis }) : null,
  ].filter((line): line is string => line !== null)
}
