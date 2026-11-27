import type { MedusaContainer } from "@medusajs/framework/types"
import type { SummaryDoc } from "../../lib/catalog/summary"
import { fakeOrigin } from "../../lib/migration/fetch"
import { FetchPace } from "../../lib/migration/fetch-pace"
import { MIGRATION_KINDS } from "../../lib/migration/types"
import type { MigrationSource } from "../../lib/migration/types"
import type { SheetCell } from "../../lib/sheets"
import { MIGRATION_MODULE } from "../../modules/migration"
import type MigrationModuleService from "../../modules/migration/service"
import { migrateCategories } from "./categories"
import { migrateCategoryCovers } from "./category-covers"
import { runDescriptionRefresh } from "./descriptions"
import { migrateImages } from "./images"
import { runPostImageRefresh } from "./post-images"
import { emptyCounts } from "./report"
import type { KindCounts, ReportProblem, RunCounts } from "./report"
import { RunPhases, weighted } from "./run-phase"
import { fillSummaries } from "./summaries"

type Container = Pick<MedusaContainer, "resolve">

/**
 * The completions (adr/0042 Ek 2026-11-27): each takes one part of what
 * earlier runs moved, and nothing else, and is safe to run again.
 * - `descriptions` (ADR-0055): the moved products' descriptions written
 *   again from the source, over the panel's edits;
 * - `post_images`: the pictures in the moved posts' texts (post-images.ts);
 * - `images`: the moved products' pictures no run stored (unreachable,
 *   refused): fetched again; the stored ones, their order and the cover
 *   the owner chose stay;
 * - `summaries` (adr/0055 Ek 2026-11-06): a short description for a moved
 *   product without one (summaries.ts: the shop's own is never touched);
 * - `category_covers` (adr/0042 Ek 2026-11-06): a picture for a moved
 *   category without one.
 * Every source may refresh `images`; the rest need a WordPress export.
 */
export const REFRESH_KINDS = [
  "descriptions",
  "post_images",
  "images",
  "summaries",
  "category_covers",
] as const
export type RefreshKind = (typeof REFRESH_KINDS)[number]
/** What a Shopify store or a product feed may refresh: only their products' pictures. */
export const ANY_SOURCE_REFRESH = ["images"] as const satisfies readonly RefreshKind[]

interface Outcome { counts: RunCounts; productRows: SheetCell[][]; problems: ReportProblem[] }

const allCounts = (): RunCounts =>
  Object.fromEntries(
    [...MIGRATION_KINDS, "consent", "attribute"].map((kind) => [kind, emptyCounts()])
  ) as RunCounts

async function listOf<T>(items: AsyncIterable<T>): Promise<T[]> {
  const all: T[] = []
  for await (const item of items) {
    all.push(item)
  }
  return all
}

/** A refresh run's whole work: the one completion asked, its kind's counts kept with the run. */
export async function runRefresh(
  container: Container,
  source: MigrationSource,
  runId: string,
  mode: "check" | "apply",
  kind: RefreshKind,
  progress: (percent: number) => Promise<void>,
  legacy: () => ReadonlyMap<string, SummaryDoc>
): Promise<Outcome> {
  if (kind === "descriptions") {
    return runDescriptionRefresh(container, source, runId, mode, progress)
  }
  if (kind === "post_images") {
    return runPostImageRefresh(container, source, runId, mode, progress)
  }
  const apply = mode === "apply"
  const migration = container.resolve<MigrationModuleService>(MIGRATION_MODULE)
  const counts = allCounts()
  const problems: ReportProblem[] = []
  const keep = async (own: keyof RunCounts, values: KindCounts) => {
    counts[own] = values
    await migration.count(runId, own, { ...values })
  }
  const told = (done: number, total: number) => progress(5 + (total > 0 ? done / total : 1) * 95)
  if (kind === "images") {
    const phases = new RunPhases(migration, runId, ["image"])
    const products = await listOf(source.products())
    const images = await migrateImages(
      container,
      source.id,
      products,
      apply,
      weighted(
        products.map((product) => new Set(product.images).size),
        phases.track("image", told)
      ),
      fakeOrigin(),
      new FetchPace()
    )
    problems.push(...images.problems.map((problem) => ({ ...problem, kind: "image" as const })))
    await keep("image", { ...emptyCounts(), ...images.counts })
  } else if (kind === "summaries") {
    const products = await listOf(source.products())
    await progress(20)
    const fill = await fillSummaries(container, source.id, products, legacy(), apply)
    problems.push(...fill.problems.map((problem) => ({ ...problem, kind: "product" as const })))
    await keep("product", {
      ...emptyCounts(),
      read: fill.read,
      updated: fill.filled + fill.replaced,
      found: fill.same,
      // The shop's own, not moved, or without one in the source: left as they are
      skipped: fill.kept + fill.skipped + fill.empty,
      failed: fill.failed,
      summaries: fill.filled + fill.replaced,
    })
  } else {
    const categories = await listOf(source.categories())
    // Found as a run finds them; nothing made (the categories' own step, dry)
    const tree = await migrateCategories(container, source.id, categories, false, () =>
      Promise.resolve()
    )
    const phases = new RunPhases(migration, runId, ["category"])
    const covers = await migrateCategoryCovers(
      container,
      source.id,
      { categories, tree, products: [] },
      apply,
      phases.track("category", told)
    )
    problems.push(...(covers?.problems ?? []))
    await keep("category", {
      ...emptyCounts(),
      read: categories.length,
      ...(covers?.counts ?? {}),
    })
  }
  await progress(100)
  return { counts, productRows: [], problems }
}
