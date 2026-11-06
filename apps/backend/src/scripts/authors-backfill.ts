import type { ExecArgs } from "@medusajs/framework/types"
import { AUDIT_LOG_MODULE } from "../modules/audit-log"
import type AuditLogModuleService from "../modules/audit-log/service"
import { backfillAuthors } from "../workflows/content/author-backfill"

/**
 * Usage: pnpm --filter @qticaret/backend authors:backfill [apply]
 *
 * Blog authors from the names posts were given as free text before
 * authors had records (adr/0060): one author per distinct name (case and
 * spaces aside), an author already named so reused, each post linked. The
 * old text stays readable as the fallback until a later cleanup. Without
 * `apply` nothing is written: it prints what would be. Safe to run again.
 * Prints the names (authors' names are published on the posts already)
 * and how many posts each takes.
 */
export default async function run({ container, args }: ExecArgs): Promise<void> {
  const out = (line: string) => process.stdout.write(`${line}\n`)
  const apply = args.includes("apply")
  const result = await backfillAuthors(container, { apply })
  const counts = {
    posts: result.posts,
    names: result.names,
    reused: result.reused,
    created: result.created,
    linked: result.linked,
    problems: result.problems.length,
  }
  if (apply && result.linked + result.created > 0) {
    await container.resolve<AuditLogModuleService>(AUDIT_LOG_MODULE).record({
      kind: "system",
      action: "content.authors_backfilled",
      actor_type: "system",
      actor_id: null,
      resource_type: "content_author",
      resource_id: null,
      changes: counts,
    })
  }
  out(
    `authors:backfill: ${apply ? "applied" : "checked (nothing written)"} ${JSON.stringify(counts)}`
  )
  for (const row of result.plan) {
    out(`  ${row.author_id ? "REUSE" : "NEW"} "${row.name}" ${String(row.posts.length)} post(s)`)
  }
  for (const problem of result.problems) {
    out(`  FAILED "${problem.name}": ${problem.key}`)
  }
}
