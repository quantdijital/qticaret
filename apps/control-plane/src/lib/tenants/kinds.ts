/** The fixed vocabularies of a shop's record (adr/0061 §2), shared by models and validators. */

/** A company invoiced by its VKN; a sole proprietor by their TCKN. */
export const COMPANY_KINDS = ["company", "sole_proprietor"] as const
export type CompanyKind = (typeof COMPANY_KINDS)[number]

export const CONTACT_ROLES = ["owner", "billing", "technical"] as const
export type ContactRole = (typeof CONTACT_ROLES)[number]

export const DOMAIN_KINDS = ["platform_subdomain", "custom"] as const
export type DomainKind = (typeof DOMAIN_KINDS)[number]

/**
 * A custom domain's DNS check (F16.7): `pending` until its TXT record
 * proves the shop holds it, then `verified`, and `active` once it also
 * points at the platform; `failed` when no proof came in time. The
 * platform's subdomain is `verified` by definition.
 */
export const DOMAIN_VERIFICATIONS = ["pending", "verified", "active", "failed"] as const
export type DomainVerification = (typeof DOMAIN_VERIFICATIONS)[number]

/** Whether the shop's hold on the domain is proven (it may be primary, the shop may use it). */
export const isVerifiedDomain = (verification: DomainVerification): boolean =>
  verification === "verified" || verification === "active"

/**
 * Why the last check did not prove or route a domain, as the panel says
 * it: no TXT record, a TXT record with another token, DNS not answering
 * in time, no proof within the domain's time (`expired`), the proof since
 * removed from DNS (`txt_lost`, a warning: the domain stays verified), the
 * address not pointing at the platform yet.
 */
export const DOMAIN_CHECK_ERRORS = [
  "txt_missing",
  "txt_mismatch",
  "dns_unavailable",
  "expired",
  "txt_lost",
  "routing_missing",
  "routing_mismatch",
] as const
export type DomainCheckError = (typeof DOMAIN_CHECK_ERRORS)[number]

export const NOTE_MAX = 2000

/**
 * A shop's contacts and own domains are bounded (C7 review L5): no request
 * grows a shop's record without end. Reads take more than these, so a
 * full list is never cut short.
 */
export const MAX_CONTACTS = 50
export const MAX_CUSTOM_DOMAINS = 50
