import { readFile } from "node:fs/promises"
import path from "node:path"
import type { ExecArgs } from "@medusajs/framework/types"
import { looksLikeWxr, wordpressRecords, wxrText } from "../lib/migration/sources/wordpress"
import { AUDIT_LOG_MODULE } from "../modules/audit-log"
import type AuditLogModuleService from "../modules/audit-log/service"
import { recordLegacyAddresses, rememberCovers } from "../workflows/migration/legacy-addresses"
import { reserveRecordPaths } from "../workflows/migration/urls-apply"

/**
 * Usage: pnpm --filter @qticaret/backend legacy:backfill <export.xml> [apply]
 *
 * The old WordPress site's own addresses (adr/0059) for a shop whose
 * WordPress migration was applied before a run wrote them itself: each
 * moved post's and page's cover kept by its old address (the export
 * names it; the run deleted its copy, so the owner's file is named
 * here), then the subcategories' short paths into the address inventory
 * and the moved pictures' old files with the media assets they became.
 * With `apply` the short paths are kept for their categories at once
 * (`reserveRecordPaths`, as a run's end does). Without `apply` nothing is
 * written: the counts say what would be. Safe to run again. Prints the
 * counts only (paths of the shop's catalog, no person's data).
 */
export default async function run({ container, args }: ExecArgs): Promise<void> {
  const out = (line: string) => process.stdout.write(`${line}\n`)
  const [file] = args.filter((arg) => arg !== "apply")
  const apply = args.includes("apply")
  if (!file) {
    throw new Error("legacy:backfill: name the WordPress export file")
  }
  const bytes = await readFile(path.resolve(file))
  if (!looksLikeWxr(bytes)) {
    throw new Error("legacy:backfill: not a WordPress export")
  }
  const records = wordpressRecords(await wxrText(bytes))
  const covers = [...records.posts, ...records.pages].flatMap((entry) =>
    entry.content?.cover ? [{ source_key: entry.source_key, url: entry.content.cover.url }] : []
  )
  const coverCounts = await rememberCovers(container, records.id, covers, apply)
  const legacy = await recordLegacyAddresses(container, records.id, apply)
  const reserved = apply ? await reserveRecordPaths(container) : null
  const counts = { covers: coverCounts, ...legacy, ...(reserved ? { reserved } : {}) }
  if (apply) {
    await container.resolve<AuditLogModuleService>(AUDIT_LOG_MODULE).record({
      kind: "system",
      action: "migration.legacy_addresses_recorded",
      actor_type: "system",
      actor_id: null,
      resource_type: "migration",
      resource_id: null,
      changes: { source: records.id, ...counts },
    })
  }
  out(
    `legacy:backfill ${records.id}: ${apply ? "applied" : "checked (nothing written)"} ${JSON.stringify(counts)}`
  )
  if (!apply && coverCounts.added > 0) {
    out("  (files counts leave out the covers an apply would remember first)")
  }
}
