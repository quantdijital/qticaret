import { accountingPackage } from "./accounting-package"
import { aiAltText } from "./ai-alt-text"
import { aiImageEdit } from "./ai-image-edit"
import { auditLogExport } from "./audit-log-export"
import { catalogBulkEdit } from "./catalog-bulk-edit"
import { catalogDescriptionFacts } from "./catalog-description-facts"
import { catalogExport } from "./catalog-export"
import { catalogImport } from "./catalog-import"
import { contentLinkRewrite } from "./content-link-rewrite"
import { customerDataExport } from "./customer-data-export"
import { migrationInvites } from "./migration-invites"
import { migrationRun } from "./migration-run"
import { migrationSitemap } from "./migration-sitemap"
import { migrationUrls } from "./migration-urls"
import { orderExport } from "./order-export"
import { promotionCodes } from "./promotion-codes"
import { reportExport } from "./report-export"
import { seoAudit } from "./seo-audit"
import { seoSitemap } from "./seo-sitemap"
import { seoUrlStyle } from "./seo-url-style"
import { trAddressSync } from "./tr-address-sync"
import { wholesaleCarts } from "./wholesale-carts"
import { wholesaleSync } from "./wholesale-sync"
import type { JobType } from "./types"

export type { JobContext, JobResult, JobType, ResultWriter } from "./types"

// Each entry's execute takes what its own input schema returns; stored
// erased, and called only with the output of that schema
const erase = <Input>(type: JobType<Input>): JobType => type as unknown as JobType

/** The kinds of long task (adr/0014); a phase adding one adds it here. */
const JOB_TYPES: Readonly<Record<string, JobType>> = Object.freeze({
  "accounting.package": erase(accountingPackage),
  "ai.alt_text": erase(aiAltText),
  "ai.image_edit": erase(aiImageEdit),
  "audit_log.export": erase(auditLogExport),
  "catalog.bulk_edit": erase(catalogBulkEdit),
  "catalog.description_facts": erase(catalogDescriptionFacts),
  "catalog.export": erase(catalogExport),
  "catalog.import": erase(catalogImport),
  "content.link_rewrite": erase(contentLinkRewrite),
  "customer.data_export": erase(customerDataExport),
  "migration.invites": erase(migrationInvites),
  "migration.run": erase(migrationRun),
  "migration.sitemap": erase(migrationSitemap),
  "migration.urls": erase(migrationUrls),
  "order.export": erase(orderExport),
  "promotion.codes": erase(promotionCodes),
  "report.export": erase(reportExport),
  "seo.audit": erase(seoAudit),
  "seo.sitemap": erase(seoSitemap),
  "seo.url_style": erase(seoUrlStyle),
  "tr_address.sync": erase(trAddressSync),
  "wholesale.carts": erase(wholesaleCarts),
  "wholesale.sync": erase(wholesaleSync),
})

/** The job type, or undefined; own keys only. */
export const jobType = (key: string): JobType | undefined =>
  Object.hasOwn(JOB_TYPES, key) ? JOB_TYPES[key] : undefined

export const JOB_TYPE_KEYS = Object.keys(JOB_TYPES)

/** The kinds only their asker and the owner see (an audit log export). */
export const PRIVATE_JOB_TYPES = JOB_TYPE_KEYS.filter((key) => JOB_TYPES[key]?.privateToAsker)

/** The platform's own kinds (the address data sync): never in the shop's panel. */
export const PLATFORM_JOB_TYPES = JOB_TYPE_KEYS.filter((key) => JOB_TYPES[key]?.platform)

/** The kinds the platform also runs on its schedule: those runs stay out of the shop's list. */
export const SCHEDULED_JOB_TYPES = JOB_TYPE_KEYS.filter((key) => JOB_TYPES[key]?.scheduled)

/** The kinds only an owner sees (a migration's). */
export const OWNER_JOB_TYPES = JOB_TYPE_KEYS.filter((key) => JOB_TYPES[key]?.ownerOnly)

/** The kinds only the owner and admin see (the wholesale sync). */
export const MANAGER_JOB_TYPES = JOB_TYPE_KEYS.filter((key) => JOB_TYPES[key]?.managersOnly)

/** The kinds one of this kind cannot run beside (itself, and its group's). */
export function exclusiveTypes(key: string): string[] {
  const group = jobType(key)?.group
  return group ? JOB_TYPE_KEYS.filter((other) => jobType(other)?.group === group) : [key]
}

/** What a request for this kind locks while it is checked and queued. */
export const queueLockKey = (key: string): string => `async-job:${jobType(key)?.group ?? key}`
