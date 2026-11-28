import type { MedusaContainer } from "@medusajs/framework/types"
import { fakeOrigin } from "../../lib/migration/fetch"
import { FetchPace } from "../../lib/migration/fetch-pace"
import type { PackageDefaults, StepProgress } from "../../lib/migration/types"
import { MIGRATION_KINDS } from "../../lib/migration/types"
import type { MigrationSource } from "../../lib/migration/types"
import type { SheetCell } from "../../lib/sheets"
import { MIGRATION_MODULE } from "../../modules/migration"
import type MigrationModuleService from "../../modules/migration/service"
import type { ImportHooks } from "../catalog/import/run"
import type { AttributedProduct } from "./attributes"
import { migrateBrands } from "./brands"
import { migrateCategories } from "./categories"
import { migrateCategoryCovers } from "./category-covers"
import { migrateCustomers, migrateOrders } from "./customers"
import { migrateImages } from "./images"
import { RUN_KINDS } from "./kinds"
import type { RunKind } from "./kinds"
import { emptyCounts } from "./report"
import type { KindCounts, ReportProblem, RunCounts } from "./report"
import { migrateReviews } from "./reviews"
import { moveContent, takesNote } from "./run-content"
import { moveProducts } from "./run-products"
import { RunPhases, weighted } from "./run-phase"
import { inventoryFromItems } from "./urls"

type Container = Pick<MedusaContainer, "resolve">

export interface MigrationHooks {
  progress: (percent: number) => Promise<void>
  /** An audit entry: `migration.<action>`. */
  audit: (action: string, changes: Record<string, unknown>) => Promise<void>
  origin: ImportHooks["origin"]
}

// Each kind's share of the progress bar, in the order a run takes them
const SPAN = {
  category: [0, 4],
  brand: [4, 8],
  product: [8, 50],
  image: [50, 68],
  cover: [68, 70],
  customer: [70, 82],
  order: [82, 88],
  review: [88, 93],
  content: [93, 99],
} as const

// A list read from a source beats this often: a slow one stays alive
const BEAT_EVERY = 100

const spanOf =
  (hooks: MigrationHooks, [from, to]: readonly [number, number]): StepProgress =>
  (done, total) =>
    hooks.progress(from + (total > 0 ? done / total : 1) * (to - from))

/** A source's list read whole, the job's heartbeat kept as it goes. */
async function listOf<T>(items: AsyncIterable<T>, beat: () => Promise<void>): Promise<T[]> {
  const all: T[] = []
  for await (const item of items) {
    all.push(item)
    if (all.length % BEAT_EVERY === 0) {
      await beat()
    }
  }
  return all
}

const counted = (values: Partial<KindCounts>): KindCounts => ({ ...emptyCounts(), ...values })

/**
 * A shop's old platform moved here (F14, adr/0042): categories and brands
 * first (the products name them), the products through the catalog import
 * in groups (run-products.ts) and their pictures, then customers, their
 * old orders and the reviews, then blog posts and content pages (those
 * without their own text kept for their addresses, F14.7). Only the
 * `kinds` asked are moved (adr/0042 Ek 2026-11-27; with what they need,
 * kinds.ts): a kind left out is not read and keeps no counts. A dry run
 * writes nothing and counts what a run would do. Every record is kept
 * against its source key, so a run again (one that stopped half-way)
 * makes nothing twice. Each kind's counts are added to the run's as it
 * ends; the live step (which kind, how many of how many) as it goes.
 */
export async function runMigration(
  container: Container,
  source: MigrationSource,
  runId: string,
  mode: "check" | "apply",
  defaults: PackageDefaults | null,
  hooks: MigrationHooks,
  kinds: readonly RunKind[] = RUN_KINDS
): Promise<{ counts: RunCounts; productRows: SheetCell[][]; problems: ReportProblem[] }> {
  const apply = mode === "apply"
  const takes = (kind: RunKind) => kinds.includes(kind)
  const migration = container.resolve<MigrationModuleService>(MIGRATION_MODULE)
  const phases = new RunPhases(migration, runId, kinds)
  const counts = {} as RunCounts
  const problems: ReportProblem[] = []
  const keep = async (kind: keyof RunCounts, values: Partial<KindCounts>) => {
    counts[kind] = counted(values)
    await migration.count(runId, kind, { ...counts[kind] })
  }
  const beat = (kind: keyof typeof SPAN) => () => hooks.progress(SPAN[kind][0])
  // A kind left out tells nothing: its step runs empty only for what others need of it
  const step = (kind: RunKind, span: keyof typeof SPAN): StepProgress =>
    takes(kind) ? phases.track(kind, spanOf(hooks, SPAN[span])) : () => Promise.resolve()

  // What the source left out as it read
  problems.push(...(source.notes?.() ?? []).filter((note) => takesNote(kinds, note.kind)))
  const categories = takes("category") ? await listOf(source.categories(), beat("category")) : []
  const tree = await migrateCategories(
    container,
    source.id,
    categories,
    apply,
    step("category", "category")
  )
  if (takes("category")) {
    problems.push(...tree.problems.map((problem) => ({ ...problem, kind: "category" as const })))
    await keep("category", tree.counts)
  }

  const brands = await migrateBrands(
    container,
    source.id,
    takes("brand") ? await listOf(source.brands(), beat("brand")) : [],
    apply,
    step("brand", "brand")
  )
  if (takes("brand")) {
    await keep("brand", brands.counts)
  }

  const products: AttributedProduct[] = takes("product")
    ? await listOf(source.products(), beat("product"))
    : []
  let productRows: SheetCell[][] = []
  if (takes("product")) {
    const moved = await moveProducts(
      container,
      source.id,
      products,
      { categoryHandle: tree.handleOf, brandHandle: brands.handleOf },
      mode,
      defaults,
      { progress: step("product", "product"), audit: hooks.audit, origin: hooks.origin }
    )
    productRows = moved.rows
    problems.push(...moved.problems)
    await keep("product", moved.product)
    await keep("attribute", moved.attribute)
  }

  // One pace for the run's fetches from the old site: products' pictures, then posts'
  const pace = new FetchPace()
  if (takes("image")) {
    const images = await migrateImages(
      container,
      source.id,
      products,
      apply,
      // Told in pictures, not products: 612 / 1002
      weighted(
        products.map((product) => new Set(product.images).size),
        step("image", "image")
      ),
      fakeOrigin(),
      pace
    )
    problems.push(...images.problems.map((problem) => ({ ...problem, kind: "image" as const })))
    await keep("image", images.counts)
  }
  // The categories' own pictures, after the products' (the same file is stored once)
  const covers = takes("category")
    ? await migrateCategoryCovers(
        container,
        source.id,
        { categories, tree, products },
        apply,
        step("category", "cover")
      )
    : null
  if (covers) {
    problems.push(...covers.problems)
    counts.category = { ...counts.category, ...covers.counts }
    await migration.count(runId, "category", { ...covers.counts })
  }

  const customers = await migrateCustomers(
    container,
    source.id,
    runId,
    takes("customer") ? await listOf(source.customers(), beat("customer")) : [],
    apply,
    step("customer", "customer")
  )
  if (takes("customer")) {
    problems.push(
      ...customers.problems.map((problem) => ({ ...problem, kind: "customer" as const }))
    )
    await keep("customer", customers.counts)
    await keep("consent", { read: customers.counts.consents, created: customers.counts.consents })
  }

  if (takes("order")) {
    const orders = await migrateOrders(
      container,
      source.id,
      await listOf(source.orders(), beat("order")),
      customers.ids,
      apply,
      step("order", "order")
    )
    await keep("order", {
      read: orders.read,
      created: orders.added,
      found: orders.read - orders.added,
    })
  }

  if (takes("review")) {
    const reviews = await migrateReviews(
      container,
      source.id,
      await listOf(source.reviews(), beat("review")),
      new Set(products.map((product) => product.source_key)),
      customers.ids,
      apply,
      step("review", "review")
    )
    problems.push(...reviews.problems.map((problem) => ({ ...problem, kind: "review" as const })))
    await keep("review", reviews.counts)
  }

  if (takes("post") || takes("page")) {
    await moveContent(container, source, {
      runId,
      takes,
      apply,
      pace,
      counts,
      problems,
      keep,
      progress: step(takes("post") ? "post" : "page", "content"),
    })
  }
  if (apply && takes("url")) {
    // Every old address the records had, for the 301s (F14.7)
    await phases.at("url", 0, 1)
    await inventoryFromItems(container, source.id)
    await phases.at("url", 1, 1)
  }
  await hooks.progress(100)
  // A kind left out counts nothing (the report lists every kind; the summary names those taken)
  const own: Partial<RunCounts> = counts
  for (const kind of [...MIGRATION_KINDS, "consent", "attribute"] as const) {
    own[kind] ??= emptyCounts()
  }
  return { counts, productRows, problems }
}
