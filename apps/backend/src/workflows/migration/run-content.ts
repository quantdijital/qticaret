import type { MedusaContainer } from "@medusajs/framework/types"
import type { FetchPace } from "../../lib/migration/fetch-pace"
import type { MigrationSource, StepProgress } from "../../lib/migration/types"
import { MIGRATION_MODULE } from "../../modules/migration"
import type MigrationModuleService from "../../modules/migration/service"
import { migrateContent } from "./content"
import { RUN_KINDS } from "./kinds"
import type { RunKind } from "./kinds"
import { emptyCounts } from "./report"
import type { KindCounts, ReportProblem, RunCounts } from "./report"

type Container = Pick<MedusaContainer, "resolve">

/** A list read whole. */
async function listOf<T>(items: AsyncIterable<T>, beat: () => Promise<void>): Promise<T[]> {
  const all: T[] = []
  for await (const item of items) {
    all.push(item)
    if (all.length % 100 === 0) {
      await beat()
    }
  }
  return all
}

// A source's note belongs to a kind the run takes (a post's to the blog's terms too)
export function takesNote(kinds: readonly RunKind[], kind: string): boolean {
  const own = kind === "post_category" || kind === "post_tag" ? "post" : kind
  return !(RUN_KINDS as readonly string[]).includes(own) || kinds.includes(own as RunKind)
}

/**
 * Posts and pages with their own text are written; the rest keep their old
 * addresses (F14.7). The pictures in their texts count with the products'
 * (adr/0042 Ek 2026-11-27).
 */
export async function moveContent(
  container: Container,
  source: MigrationSource,
  run: {
    runId: string
    takes: (kind: RunKind) => boolean
    apply: boolean
    pace: FetchPace
    counts: RunCounts
    problems: ReportProblem[]
    keep: (kind: keyof RunCounts, values: Partial<KindCounts>) => Promise<void>
    progress: StepProgress
  }
): Promise<void> {
  const beat = () => run.progress(0, 1)
  const content = await migrateContent(
    container,
    source.id,
    run.takes("post") && source.posts ? await listOf(source.posts(), beat) : [],
    run.takes("page") ? await listOf(source.pages(), beat) : [],
    run.apply,
    run.progress,
    run.pace
  )
  run.problems.push(...content.problems)
  const kinds = run.takes("post") ? (["post_category", "post_tag", "post"] as const) : ([] as const)
  for (const kind of [...kinds, ...(run.takes("page") ? (["page"] as const) : [])]) {
    await run.keep(kind, content.counts[kind])
  }
  const image = (run.counts as Partial<RunCounts>).image ?? emptyCounts()
  for (const key of ["read", "created", "found", "skipped"] as const) {
    image[key] += content.images[key]
  }
  run.counts.image = image
  await container
    .resolve<MigrationModuleService>(MIGRATION_MODULE)
    .count(run.runId, "image", { ...content.images })
}
