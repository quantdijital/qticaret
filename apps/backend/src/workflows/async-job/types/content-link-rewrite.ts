import { randomUUID } from "node:crypto"
import { z } from "@medusajs/framework/zod"
import { isHostname } from "../../../lib/seo/internal-links"
import { XLSX_MIME, writeXlsx } from "../../../lib/sheets"
import { AUDIT_LOG_MODULE } from "../../../modules/audit-log"
import type AuditLogModuleService from "../../../modules/audit-log/service"
import { linkReportSheets } from "../../content/link-report"
import { rewriteContentLinks } from "../../content/link-rewrite"
import type { LinkRewriteResult } from "../../content/link-rewrite"
import type { JobType } from "./types"

const input = z
  .object({
    // Plan only: what would change, nothing written
    dry_run: z.boolean().default(false),
    // An old domain the shop's migrations do not name (`eski-alan.com`)
    hosts: z.array(z.string().trim().toLowerCase().max(253).refine(isHostname)).max(5).default([]),
  })
  .strict()

const HEARTBEAT_MS = 60_000

/**
 * The shop's texts' links to itself rewritten (adr/0042 Ek 2026-11-05):
 * pages, posts and products' descriptions, every link to the shop or its
 * old site pointed at the page that answers it today; links elsewhere
 * never. Owner and admin queue it (`POST /admin/async-jobs`); it writes
 * products' descriptions, so it runs apart from an import, a bulk edit or
 * a migration. In the audit log with its counts; the report (xlsx) lists
 * each link moved and each that answers nothing.
 */
export const contentLinkRewrite: JobType<z.infer<typeof input>> = {
  input,
  singleton: true,
  group: "catalog.write",
  resultTtlDays: 7,
  containsPersonalData: false,
  execute: async ({ container, job, progress, resultFile }, values) => {
    await progress(5)
    // The heartbeat while the plan reads every document (the sweeper fails a job silent for 10 min)
    const heartbeat = setInterval(() => {
      void progress(5).catch(() => undefined)
    }, HEARTBEAT_MS)
    let result: LinkRewriteResult
    try {
      result = await rewriteContentLinks(container, {
        dry_run: values.dry_run,
        hosts: values.hosts,
      })
    } finally {
      clearInterval(heartbeat)
    }
    await progress(90)
    const counts = {
      documents: result.documents,
      rewritten: result.rewritten,
      changed: result.changed.length,
      unresolved: result.unresolved.length,
    }
    await container.resolve<AuditLogModuleService>(AUDIT_LOG_MODULE).record({
      kind: "system",
      action: values.dry_run ? "content.links_checked" : "content.links_rewritten",
      actor_type: job.requested_by ? "user" : "system",
      actor_id: job.requested_by,
      resource_type: "async_job",
      resource_id: job.id,
      changes: { ...counts, ...(values.hosts.length > 0 ? { hosts: values.hosts } : {}) },
    })
    const file = await resultFile(`baglanti-raporu-${randomUUID()}.xlsx`, XLSX_MIME)
    for await (const chunk of writeXlsx(linkReportSheets(values.dry_run, result))) {
      await file.write(chunk as Buffer)
    }
    return { summary: { dry_run: values.dry_run, ...counts } }
  },
}
