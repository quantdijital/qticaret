import type { MedusaContainer } from "@medusajs/framework/types"
import { MIGRATION_MODULE } from "../../modules/migration"
import type MigrationModuleService from "../../modules/migration/service"
import { movedRecordCounts } from "./overview-counts"

type Container = Pick<MedusaContainer, "resolve">

/** One kind's tile: records moved here, and those a run left out (`problems`). */
export interface KindOverview {
  moved: number
  problems: number
}

/**
 * The migration page's summary (adr/0042 Ek 2026-11-27), read from what
 * the runs kept, no file needed: by kind what moved and what was left
 * out, and how much each completion would take (`missing`): products and
 * posts with a picture not stored, moved products without a short
 * description, moved categories without a picture, moved records whose
 * old address is not tied to them yet; the old addresses awaiting the
 * owner. One source of numbers for the page's tiles and rows.
 */
export async function migrationOverview(container: Container) {
  const migration = container.resolve<MigrationModuleService>(MIGRATION_MODULE)
  const tallies = await migration.tallies()
  const kinds: Record<string, KindOverview> = {}
  for (const { kind, status, count } of tallies.items) {
    const own = (kinds[kind] ??= { moved: 0, problems: 0 })
    if (status === "done") {
      own.moved += count
    } else {
      own.problems += count
    }
  }
  const moved = await movedRecordCounts(container)
  const unpictured = (kind: "product" | "post") =>
    tallies.unpictured.find((row) => row.kind === kind)?.count ?? 0
  const [, addresses] = await migration.listAndCountMigrationUrls({}, { take: 1, select: ["id"] })
  const [, undecided] = await migration.listAndCountMigrationUrls(
    { entity_id: null, decision: "auto", query: null },
    { take: 1, select: ["id"] }
  )
  const [last] = await migration.listMigrationRuns(
    { mode: "apply" },
    {
      select: ["id", "source", "mode", "status", "job_id", "created_at", "finished_at"],
      take: 1,
      order: { created_at: "DESC" },
    }
  )
  return {
    last_run: last ?? null,
    // Where records came from (`wordpress:eski-magaza.com`): which completions apply
    sources: tallies.sources,
    kinds,
    missing: {
      images: unpictured("product"),
      post_images: unpictured("post"),
      // Counted in the database, no document read (overview-counts.ts)
      summaries: moved.without_summary,
      category_covers: moved.without_cover,
      urls: tallies.unaddressed,
      descriptions: moved.products,
    },
    addresses: { total: addresses, undecided },
  }
}
