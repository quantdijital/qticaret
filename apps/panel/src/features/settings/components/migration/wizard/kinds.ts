import type { MigrationJob } from "@/features/settings/api/migration"
import {
  KIND_NEEDS,
  RUN_KIND_NAMES,
  runSummaryOf,
} from "@/features/settings/api/migration-overview"
import type { ProblemGroup, RunKindName } from "@/features/settings/api/migration-overview"
import type { CompletionKey } from "@/features/settings/components/migration/completion-rows"

/** The kinds this preview found something of (the 301s whenever anything moves). */
export function kindsFound(job: MigrationJob | undefined): RunKindName[] {
  const summary = runSummaryOf(job)
  if (!summary) {
    return []
  }
  const found = RUN_KIND_NAMES.filter(
    (kind) => kind !== "url" && (summary.counts[kind]?.["read"] ?? 0) > 0
  )
  return found.length > 0 ? [...found, "url"] : []
}

/** A kind ticked off takes the kinds needing it with it (a picture without its product). */
export function withoutKind(chosen: ReadonlySet<RunKindName>, kind: RunKindName): Set<RunKindName> {
  const next = new Set(chosen)
  const drop = (gone: RunKindName) => {
    next.delete(gone)
    for (const [other, needs] of Object.entries(KIND_NEEDS) as [RunKindName, RunKindName[]][]) {
      if (needs.includes(gone) && next.has(other)) {
        drop(other)
      }
    }
  }
  drop(kind)
  return next
}

/** The completion that fixes a group of problems, when one does. */
export function fixOf(group: ProblemGroup): CompletionKey | "products" | "addresses" | null {
  if (group.kind === "image") {
    return "images"
  }
  if (group.kind === "category" && group.key.includes("cover")) {
    return "category_covers"
  }
  if (group.kind === "post" && group.key.includes("image")) {
    return "post_images"
  }
  if (group.key.startsWith("migration.url")) {
    return "addresses"
  }
  return group.kind === "product" ? "products" : null
}
