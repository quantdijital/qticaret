import { readFile } from "node:fs/promises"
import path from "node:path"
import type { ExecArgs } from "@medusajs/framework/types"
import { looksLikeWxr, wordpressRecords, wxrText } from "../lib/migration/sources/wordpress"
import { AUDIT_LOG_MODULE } from "../modules/audit-log"
import type AuditLogModuleService from "../modules/audit-log/service"
import { fillSummaries } from "../workflows/migration/summaries"

/**
 * Usage: pnpm --filter @qticaret/backend summary:backfill <export.xml> [apply]
 *
 * Short descriptions (adr/0055 Ek 2026-11-05) for a shop whose WordPress
 * products moved in before migrations read the excerpt: the export the
 * run read (a run deletes its stored copy, so the owner's file is named
 * here) gives each product's lines, and every product a run made from it
 * gets them where it has none. Without `apply` nothing is written: the
 * counts say what would be. Safe to run again. Prints counts and the
 * products whose excerpt did not split cleanly (their source keys and
 * names: the shop's catalog, no person's data).
 */
export default async function run({ container, args }: ExecArgs): Promise<void> {
  const out = (line: string) => process.stdout.write(`${line}\n`)
  const [file] = args.filter((arg) => arg !== "apply")
  const apply = args.includes("apply")
  if (!file) {
    throw new Error("summary:backfill: name the WordPress export file")
  }
  const bytes = await readFile(path.resolve(file))
  if (!looksLikeWxr(bytes)) {
    throw new Error("summary:backfill: not a WordPress export")
  }
  const records = wordpressRecords(await wxrText(bytes))
  const fill = await fillSummaries(container, records.id, records.products, apply)
  const partial = new Set(
    records.notes
      .filter((note) => note.key === "migration.wordpress_summary_partial")
      .map((note) => note.source_key)
  )
  const counts = {
    read: fill.read,
    updated: fill.updated,
    found: fill.found,
    skipped: fill.skipped,
    empty: fill.empty,
    failed: fill.failed,
    partial: partial.size,
  }
  if (apply) {
    await container.resolve<AuditLogModuleService>(AUDIT_LOG_MODULE).record({
      kind: "system",
      action: "migration.summaries_filled",
      actor_type: "system",
      actor_id: null,
      resource_type: "product",
      resource_id: null,
      changes: { source: records.id, ...counts },
    })
  }
  out(
    `summary:backfill ${records.id}: ${apply ? "applied" : "checked (nothing written)"} ${JSON.stringify(counts)}`
  )
  for (const product of records.products.filter((each) => partial.has(each.source_key))) {
    out(`  PARTIAL ${product.source_key} "${product.title}": ${JSON.stringify(product.summary)}`)
  }
  for (const problem of fill.problems) {
    out(`  FAILED ${problem.source_key}: ${problem.key}`)
  }
}
