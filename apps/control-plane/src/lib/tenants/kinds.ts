/** The fixed vocabularies of a shop's record (adr/0061 §2), shared by models and validators. */

/** A company invoiced by its VKN; a sole proprietor by their TCKN. */
export const COMPANY_KINDS = ["company", "sole_proprietor"] as const
export type CompanyKind = (typeof COMPANY_KINDS)[number]

export const CONTACT_ROLES = ["owner", "billing", "technical"] as const
export type ContactRole = (typeof CONTACT_ROLES)[number]

export const DOMAIN_KINDS = ["platform_subdomain", "custom"] as const
export type DomainKind = (typeof DOMAIN_KINDS)[number]

/** A custom domain waits for its DNS check (F16.7); the platform's subdomain is verified. */
export const DOMAIN_VERIFICATIONS = ["pending", "verified", "failed"] as const
export type DomainVerification = (typeof DOMAIN_VERIFICATIONS)[number]

export const NOTE_MAX = 2000
