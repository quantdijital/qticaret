import "server-only"
import { cache } from "react"
import { isStoreApiError } from "@/lib/store-api/errors"
import { storeGet } from "@/lib/store-api/server"

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
    const { document } = await storeGet<{ document: LegalDocument }>(`/store/legal/${kind}`)
    return document
  } catch (error) {
    if (isStoreApiError(error) && error.status === 404) {
      return null
    }
    throw error
  }
})
