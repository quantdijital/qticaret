/**
 * Structured data blocks (docs/13 §5, F3.12): what search engines read of
 * a page, built from the same facts the page and the feeds use. Pure: the
 * caller gathers the facts. URLs are absolute (the caller has the host);
 * prices are numeric strings without a symbol; availability and condition
 * are full schema.org URLs. The storefront escapes `<` when it prints
 * them (F18).
 */
import { SCHEMA, compact } from "./jsonld-base"
import type { JsonLd } from "./jsonld-base"

export type { JsonLd } from "./jsonld-base"
export { AVAILABILITIES, VARIES_BY_PROPERTIES, productJsonLd } from "./jsonld-product"
export { DATED_DEPARTURES, DATED_TYPES, datedJsonLd } from "./jsonld-dated"
export type { DatedFacts, DatedType, DepartureFacts, ItineraryStep } from "./jsonld-dated"
export type {
  Availability,
  Condition,
  DeliveryFacts,
  ProductFacts,
  ReturnPolicyFacts,
  VariantFacts,
  VariesBy,
} from "./jsonld-product"

export interface ListingFacts {
  name: string
  description: string
  /** The first page of products, as the storefront lists them. */
  items: { name: string; url: string }[]
}

/** A category, brand or collection page: what it is and the products it lists first. */
export function listingJsonLd(facts: ListingFacts, url: string): JsonLd {
  return compact({
    "@context": SCHEMA,
    "@type": "CollectionPage",
    name: facts.name,
    description: facts.description,
    url,
    mainEntity:
      facts.items.length > 0
        ? {
            "@type": "ItemList",
            itemListElement: facts.items.map((item, index) => ({
              "@type": "ListItem",
              position: index + 1,
              url: item.url,
              name: item.name,
            })),
          }
        : undefined,
  })
}

export function breadcrumbJsonLd(crumbs: readonly { name: string; url: string }[]): JsonLd | null {
  if (crumbs.length < 2) {
    return null
  }
  return {
    "@context": SCHEMA,
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: crumb.url,
    })),
  }
}

/** A content page's or blog post's facts (F3.16, docs/13 §5). */
export interface ArticleFacts {
  /** A blog post is a `BlogPosting`; a content page (about, delivery terms) a `WebPage`. */
  type: "BlogPosting" | "WebPage"
  headline: string
  description: string
  /** ISO dates: first published, last changed in its text. */
  datePublished: string | null
  dateModified: string | null
  /** The author's record (adr/0060), or the name alone a post had before authors had records. */
  author: string | PersonFacts | null
  image: string | null
  publisher: string
}

/** A person as the structured data names them (adr/0060): a post's author, a profile page's subject. */
export interface PersonFacts {
  name: string
  /** Absolute: their page on the shop. */
  url?: string | null
  jobTitle?: string | null
  image?: string | null
  description?: string | null
  /** Their own pages elsewhere (website, LinkedIn, Instagram, X). */
  sameAs?: readonly string[]
}

/** A `Person` node, nested in another block (no `@context` of its own). */
export function personJsonLd(person: PersonFacts): JsonLd {
  return compact({
    "@type": "Person",
    name: person.name,
    url: person.url,
    jobTitle: person.jobTitle,
    image: person.image,
    description: person.description,
    sameAs: person.sameAs ? [...person.sameAs] : undefined,
  })
}

/**
 * A blog author's page (adr/0060): a `ProfilePage` whose main entity is
 * the `Person` (Google's profile page structured data).
 */
export function profilePageJsonLd(
  facts: { person: PersonFacts; name: string; description: string; dateModified: string | null },
  url: string
): JsonLd {
  return compact({
    "@context": SCHEMA,
    "@type": "ProfilePage",
    name: facts.name,
    description: facts.description,
    url,
    dateModified: facts.dateModified,
    mainEntity: personJsonLd({ ...facts.person, url }),
  })
}

export function articleJsonLd(facts: ArticleFacts, url: string): JsonLd {
  if (facts.type === "WebPage") {
    return compact({
      "@context": SCHEMA,
      "@type": "WebPage",
      name: facts.headline,
      description: facts.description,
      url,
      dateModified: facts.dateModified ?? facts.datePublished,
    })
  }
  return compact({
    "@context": SCHEMA,
    "@type": "BlogPosting",
    headline: facts.headline,
    description: facts.description,
    url,
    mainEntityOfPage: url,
    image: facts.image ? [facts.image] : undefined,
    datePublished: facts.datePublished,
    dateModified: facts.dateModified ?? facts.datePublished,
    author: !facts.author
      ? undefined
      : typeof facts.author === "string"
        ? { "@type": "Person", name: facts.author }
        : personJsonLd(facts.author),
    publisher: { "@type": "Organization", name: facts.publisher },
  })
}

/** The shop's legal identity as the structured data shows it (F13.9). */
export interface SiteIdentity {
  legalName: string | null
  taxID: string | null
  address: string | null
  email: string | null
  telephone: string | null
  sameAs: readonly string[]
  /** When customer service answers (adr/0048): schema.org day addresses and `HH:MM`. */
  hours?: readonly { dayOfWeek: string; opens: string; closes: string }[]
}

// How to reach customer service: its phone, e-mail and hours (Google reads `contactPoint`)
function contactPointOf(identity: SiteIdentity | undefined) {
  if (!identity || (!identity.telephone && !identity.email)) {
    return undefined
  }
  return compact({
    "@type": "ContactPoint",
    contactType: "customer service",
    telephone: identity.telephone ?? undefined,
    email: identity.email ?? undefined,
    areaServed: "TR",
    availableLanguage: "tr",
    hoursAvailable: identity.hours?.length
      ? identity.hours.map((range) => ({ "@type": "OpeningHoursSpecification", ...range }))
      : undefined,
  })
}

/**
 * The home page's blocks (docs/13 §5): the shop as an `OnlineStore` (the
 * most specific organisation type for a web shop) with its legal identity
 * where given (F13.9), and the `WebSite` without a search action (Google
 * dropped the sitelinks search box).
 */
export function siteJsonLd(
  shop: { name: string; url: string; logo: string | null },
  identity?: SiteIdentity
): JsonLd[] {
  return [
    compact({
      "@context": SCHEMA,
      "@type": "OnlineStore",
      name: shop.name,
      url: shop.url,
      logo: shop.logo,
      legalName: identity?.legalName ?? undefined,
      taxID: identity?.taxID ?? undefined,
      address: identity?.address
        ? { "@type": "PostalAddress", streetAddress: identity.address, addressCountry: "TR" }
        : undefined,
      email: identity?.email ?? undefined,
      telephone: identity?.telephone ?? undefined,
      sameAs: identity?.sameAs.length ? [...identity.sameAs] : undefined,
      contactPoint: contactPointOf(identity),
    }),
    { "@context": SCHEMA, "@type": "WebSite", name: shop.name, url: shop.url },
  ]
}
