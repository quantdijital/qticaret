import type { Metadata } from "next"
import type { SeoPayload } from "@qticaret/types"

/**
 * The backend's `seo` object as Next's metadata, printed in the first
 * HTML's <head> (`htmlLimitedBots: /.*\/`; docs/13 §1). Nothing is made up
 * here: no title template, no description of our own, no canonical when
 * the backend has none (its host is not set yet).
 */
export function metadataOf(seo: SeoPayload): Metadata {
  const image = seo.openGraph.image
  return {
    title: { absolute: seo.title },
    description: seo.description === "" ? null : seo.description,
    alternates: seo.canonical ? { canonical: seo.canonical } : null,
    robots: seo.robots,
    openGraph: {
      title: seo.openGraph.title,
      description: seo.openGraph.description,
      type: seo.openGraph.type === "article" ? "article" : "website",
      siteName: seo.openGraph.siteName,
      locale: "tr_TR",
      ...(seo.openGraph.url ? { url: seo.openGraph.url } : {}),
      ...(image
        ? {
            images: [
              { url: image, ...(seo.openGraph.imageAlt ? { alt: seo.openGraph.imageAlt } : {}) },
            ],
          }
        : {}),
    },
    twitter: {
      card: seo.twitter.card,
      title: seo.twitter.title,
      description: seo.twitter.description,
      ...(seo.twitter.image ? { images: [seo.twitter.image] } : {}),
    },
  }
}

/** A page with no seo object of its own (cart, account): its robots value only. */
export const robotsOnly = (robots: SeoPayload["robots"], title: string): Metadata => ({
  title: { absolute: title },
  robots,
})
