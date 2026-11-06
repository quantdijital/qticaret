import { readFile } from "node:fs/promises"
import path from "node:path"
import type { ExecArgs } from "@medusajs/framework/types"
import { looksLikeWxr, wordpressRecords, wxrText } from "../lib/migration/sources/wordpress"
import { AUDIT_LOG_MODULE } from "../modules/audit-log"
import type AuditLogModuleService from "../modules/audit-log/service"
import { migrateCategories } from "../workflows/migration/categories"
import { setCategoryCovers } from "../workflows/migration/category-covers"

/**
 * Usage: pnpm --filter @qticaret/backend category-covers:backfill <export.xml> [apply]
 *
 * The product categories' own pictures (adr/0042 Ek 2026-11-06) for a
 * shop whose WordPress migration was applied before a run set them: the
 * export a run read (a run deletes its stored copy, so the owner's file is
 * named here) gives each category's picture (`thumbnail_id`). Each
 * category found here as a run finds it (the migration's record of it,
 * else its name under the same parent) gets its picture unless it has
 * one: the shop's own is never written over. A file the migration stored
 * already is used again; else it is fetched from the old site over HTTPS
 * under the SSRF rules. Without `apply` nothing is written or fetched: the
 * counts say what would be. Safe to run again. Prints the counts and the
 * pictures not set with why (source keys and file addresses of the shop's
 * catalog, no person's data).
 */
export default async function run({ container, args }: ExecArgs): Promise<void> {
  const out = (line: string) => process.stdout.write(`${line}\n`)
  const [file] = args.filter((arg) => arg !== "apply")
  const apply = args.includes("apply")
  if (!file) {
    throw new Error("category-covers:backfill: name the WordPress export file")
  }
  const bytes = await readFile(path.resolve(file))
  if (!looksLikeWxr(bytes)) {
    throw new Error("category-covers:backfill: not a WordPress export")
  }
  const records = wordpressRecords(await wxrText(bytes))
  // Found as a run finds them, nothing made or written (a dry run of the categories' step)
  const tree = await migrateCategories(container, records.id, records.categories, false, () =>
    Promise.resolve()
  )
  const { counts, problems } = await setCategoryCovers(
    container,
    records.id,
    records.categories,
    (category) => tree.idOf(category.path),
    apply
  )
  if (apply) {
    await container.resolve<AuditLogModuleService>(AUDIT_LOG_MODULE).record({
      kind: "system",
      action: "migration.category_covers_set",
      actor_type: "system",
      actor_id: null,
      resource_type: "product_category",
      resource_id: null,
      changes: { source: records.id, ...counts },
    })
  }
  out(
    `category-covers:backfill ${records.id}: ${apply ? "applied" : "checked (nothing written)"} ${JSON.stringify(counts)}`
  )
  const missing = records.notes.filter(
    (note) => note.key === "migration.wordpress_category_image_missing"
  )
  for (const problem of [...missing, ...problems]) {
    out(`  FAILED ${problem.source_key}: ${problem.key}`)
  }
}
