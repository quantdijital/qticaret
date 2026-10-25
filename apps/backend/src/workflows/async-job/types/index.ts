import { auditLogExport } from "./audit-log-export"
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
  "seo.sitemap": erase(seoSitemap),
  "seo.url_style": erase(seoUrlStyle),
})

/** The job type, or undefined; own keys only. */
export const jobType = (key: string): JobType | undefined =>
  Object.hasOwn(JOB_TYPES, key) ? JOB_TYPES[key] : undefined

export const JOB_TYPE_KEYS = Object.keys(JOB_TYPES)
