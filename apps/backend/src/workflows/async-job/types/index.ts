import { auditLogExport } from "./audit-log-export"
import { catalogBulkEdit } from "./catalog-bulk-edit"
import { catalogExport } from "./catalog-export"
import { catalogImport } from "./catalog-import"
import { seoAudit } from "./seo-audit"
import { seoSitemap } from "./seo-sitemap"
import { seoUrlStyle } from "./seo-url-style"
import type { JobType } from "./types"

export type { JobContext, JobResult, JobType, ResultWriter } from "./types"

// Each entry's execute takes what its own input schema returns; stored
// erased, and called only with the output of that schema
const erase = <Input>(type: JobType<Input>): JobType => type as unknown as JobType

/** The kinds of long task (adr/0014); a phase adding one adds it here. */
const JOB_TYPES: Readonly<Record<string, JobType>> = Object.freeze({
  "audit_log.export": erase(auditLogExport),
  "catalog.bulk_edit": erase(catalogBulkEdit),
  "catalog.export": erase(catalogExport),
  "catalog.import": erase(catalogImport),
  "seo.audit": erase(seoAudit),
  "seo.sitemap": erase(seoSitemap),
  "seo.url_style": erase(seoUrlStyle),
})

/** The job type, or undefined; own keys only. */
export const jobType = (key: string): JobType | undefined =>
  Object.hasOwn(JOB_TYPES, key) ? JOB_TYPES[key] : undefined

export const JOB_TYPE_KEYS = Object.keys(JOB_TYPES)

/** The kinds one of this kind cannot run beside (itself, and its group's). */
export function exclusiveTypes(key: string): string[] {
  const group = jobType(key)?.group
  return group ? JOB_TYPE_KEYS.filter((other) => jobType(other)?.group === group) : [key]
}

/** What a request for this kind locks while it is checked and queued. */
export const queueLockKey = (key: string): string => `async-job:${jobType(key)?.group ?? key}`
