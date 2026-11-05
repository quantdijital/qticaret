import { readFile } from "node:fs/promises"
import path from "node:path"
import type { ExecArgs } from "@medusajs/framework/types"
import { looksLikeWxr, wordpressRecords, wxrText } from "../lib/migration/sources/wordpress"
import { legacySummaries } from "../lib/migration/sources/wordpress/legacy-summary"
import { readWxr } from "../lib/migration/sources/wordpress/reader"
import { AUDIT_LOG_MODULE } from "../modules/audit-log"
import type AuditLogModuleService from "../modules/audit-log/service"
import { fillSummaries } from "../workflows/migration/summaries"

/**
 * Usage: pnpm --filter @qticaret/backend summary:backfill <export.xml> [apply]
 *
 * Short descriptions as the shop wrote them (adr/0055 Ek 2026-11-06) for
 * a shop whose WordPress products moved before: the export a run read (a
 * run deletes its stored copy, so the owner's file is named here) gives
 * each product's excerpt. A product without a short description gets it;
 * one still holding the bullet list the 2026-11-05 build wrote (and never
 * changed in the panel) gets it in that list's place; the shop's own are
 * left as they are (`fillSummaries`). Without `apply` nothing is written:
 * the counts say what would be. Safe to run again. Prints the counts, the
 * earlier fills' audit entries (`migration.summaries_filled`) to compare
 * with, and the products cut at the 1,500-character cap and the ones kept
 * as the shop's (source keys and names: the shop's catalog, no person's
 * data).
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
  const text = await wxrText(bytes)
  const records = wordpressRecords(text)
  const audit = container.resolve<AuditLogModuleService>(AUDIT_LOG_MODULE)
  const earlier = await audit.listAuditEntries(
    { action: "migration.summaries_filled" },
    { select: ["created_at", "changes"], order: { created_at: "ASC" } }
  )
  const fill = await fillSummaries(
    container,
    records.id,
    records.products,
    legacySummaries(readWxr(text)),
    apply
  )
  const cut = new Set(
    records.notes
      .filter((note) => note.key === "migration.wordpress_summary_cut")
      .map((note) => note.source_key)
  )
  const counts = {
    read: fill.read,
    filled: fill.filled,
    replaced: fill.replaced,
    same: fill.same,
    kept: fill.kept,
    skipped: fill.skipped,
    empty: fill.empty,
    failed: fill.failed,
    cut: cut.size,
  }
  if (apply) {
    await audit.record({
      kind: "system",
      action: "migration.summaries_filled",
      actor_type: "system",
      actor_id: null,
      resource_type: "product",
      resource_id: null,
      changes: { source: records.id, as_written: true, ...counts },
    })
  }
  out(
    `summary:backfill ${records.id}: ${apply ? "applied" : "checked (nothing written)"} ${JSON.stringify(counts)}`
  )
  for (const entry of earlier) {
    out(`  EARLIER ${entry.created_at.toISOString()} ${JSON.stringify(entry.changes)}`)
  }
  const named = new Map(records.products.map((product) => [product.source_key, product.title]))
  for (const key of cut) {
    out(`  CUT ${key} "${named.get(key) ?? ""}"`)
  }
  for (const key of fill.keptKeys) {
    out(`  KEPT ${key} "${named.get(key) ?? ""}"`)
  }
  for (const problem of fill.problems) {
    out(`  FAILED ${problem.source_key}: ${problem.key}`)
  }
}
