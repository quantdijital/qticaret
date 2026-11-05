import type { ExecArgs } from "@medusajs/framework/types"
import { AUDIT_LOG_MODULE } from "../modules/audit-log"
import type AuditLogModuleService from "../modules/audit-log/service"
import { rewriteContentLinks } from "../workflows/content/link-rewrite"
import { reserveRecordPaths } from "../workflows/migration/urls-apply"

/**
 * Usage: pnpm --filter @qticaret/backend links:rewrite [check|apply] [reserve]
 *
 * The content link rewrite (adr/0042 Ek 2026-11-05) for a shop whose texts
 * moved in before migrations did it themselves: `check` (the default)
 * prints what would change, `apply` writes it, as the panel's job does
 * (`content.link_rewrite`). `reserve` first keeps the migrated records'
 * old paths for them, as an apply of the old addresses would (Settings >
 * Migration), so the links to them resolve. Safe to run again. Prints the
 * counts and each link it could not resolve (a document's title, never a
 * person's data).
 */
export default async function run({ container, args }: ExecArgs): Promise<void> {
  const apply = args.includes("apply")
  const out = (line: string) => process.stdout.write(`${line}\n`)
  if (args.includes("reserve")) {
    const reserved = await reserveRecordPaths(container)
    out(`links:rewrite: old paths kept for their records: ${JSON.stringify(reserved)}`)
  }
  const result = await rewriteContentLinks(container, { dry_run: !apply })
  const counts = {
    documents: result.documents,
    rewritten: result.rewritten,
    changed: result.changed.length,
    unresolved: result.unresolved.length,
  }
  if (apply) {
    await container.resolve<AuditLogModuleService>(AUDIT_LOG_MODULE).record({
      kind: "system",
      action: "content.links_rewritten",
      actor_type: "system",
      actor_id: null,
      resource_type: "content",
      resource_id: null,
      changes: counts,
    })
  }
  out(`links:rewrite: ${apply ? "applied" : "checked (nothing written)"} ${JSON.stringify(counts)}`)
  for (const link of result.changed) {
    out(`  ${link.kind} "${link.title}": ${link.href} -> ${link.target ?? ""}`)
  }
  for (const link of result.unresolved) {
    out(`  UNRESOLVED (${link.reason ?? ""}) ${link.kind} "${link.title}": ${link.href}`)
  }
}
