import type { MedusaContainer } from "@medusajs/framework/types"
import { goesLiveAsDraft, packageOf } from "../../lib/migration/sheet"
import type { PackageDefaults, SourceProduct, StepProgress } from "../../lib/migration/types"
import type { MigrationSource } from "../../lib/migration/types"
import type { SheetCell } from "../../lib/sheets"
import { MIGRATION_MODULE } from "../../modules/migration"
import type MigrationModuleService from "../../modules/migration/service"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import type { StoreSettings } from "../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"
import type { ImportHooks } from "../catalog/import/run"
import { migrateBrands } from "./brands"
import { migrateCategories } from "./categories"
import { migrateCustomers, migrateOrders } from "./customers"
import { migrateProducts } from "./products"
import { emptyCounts } from "./report"
import type { KindCounts, ReportProblem, RunCounts } from "./report"
import { migrateReviews } from "./reviews"

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
  product: [8, 70],
  customer: [70, 85],
  order: [85, 92],
  review: [92, 99],
} as const

// Rows a catalog import takes at once, well within its limit (5,000)
const PRODUCT_ROWS = 1_000
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

/** Products in groups whose rows (one per variant) one catalog import takes. */
function batchesOf(products: readonly SourceProduct[]): SourceProduct[][] {
  const batches: SourceProduct[][] = []
  let current: SourceProduct[] = []
  let rows = 0
  for (const product of products) {
    if (current.length > 0 && rows + product.variants.length > PRODUCT_ROWS) {
      batches.push(current)
      current = []
      rows = 0
    }
    current.push(product)
    rows += product.variants.length
  }
  return current.length > 0 ? [...batches, current] : batches
}

const counted = (values: Partial<KindCounts>): KindCounts => ({ ...emptyCounts(), ...values })

/**
 * A shop's old platform moved here (F14, adr/0042): categories and brands
 * first (the products name them), the products through the catalog import
 * in groups, then customers, their old orders and the reviews; the other
 * pages are kept for their addresses (F14.7). A live product without its
 * measurements takes the owner's `defaults`, else comes as a draft; each
 * is named in the report. A dry run writes nothing and
 * counts what a run would do. Every record is kept against its source key,
 * so a run again (one that stopped half-way) makes nothing twice. Each
 * kind's counts are added to the run's as it ends.
 */
export async function runMigration(
  container: Container,
  source: MigrationSource,
  runId: string,
  mode: "check" | "apply",
  defaults: PackageDefaults | null,
  hooks: MigrationHooks
): Promise<{ counts: RunCounts; productRows: SheetCell[][]; problems: ReportProblem[] }> {
  const apply = mode === "apply"
  const migration = container.resolve<MigrationModuleService>(MIGRATION_MODULE)
  const counts = {} as RunCounts
  const problems: ReportProblem[] = []
  const keep = async (kind: keyof RunCounts, values: Partial<KindCounts>) => {
    counts[kind] = counted(values)
    await migration.count(runId, kind, { ...counts[kind] })
  }
  const beat = (kind: keyof typeof SPAN) => () => hooks.progress(SPAN[kind][0])

  const categories = await listOf(source.categories(), beat("category"))
  const tree = await migrateCategories(
    container,
    source.id,
    categories,
    apply,
    spanOf(hooks, SPAN.category)
  )
  await keep("category", tree.counts)

  const brands = await migrateBrands(
    container,
    source.id,
    await listOf(source.brands(), beat("brand")),
    apply,
    spanOf(hooks, SPAN.brand)
  )
  await keep("brand", brands.counts)

  const products = await listOf(source.products(), beat("product"))
  const settings = (await container
    .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    .getSection("store")) as unknown as StoreSettings
  const refs = {
    units: { weight: settings.weight_unit, dimension: settings.dimension_unit },
    categoryHandle: tree.handleOf,
    brandHandle: brands.handleOf,
    defaults,
  }
  for (const product of products) {
    const pack = packageOf(product, defaults)
    const key = goesLiveAsDraft(product, pack)
      ? "migration.product_drafted_no_parcel"
      : pack.defaulted
        ? "migration.product_parcel_defaulted"
        : null
    if (key) {
      problems.push({ kind: "product", source_key: product.source_key, key })
    }
  }
  const productRows: SheetCell[][] = []
  const productCounts = counted({ read: products.length })
  const batches = batchesOf(products)
  const productSpan = spanOf(hooks, SPAN.product)
  for (const [index, batch] of batches.entries()) {
    const { summary, rows } = await migrateProducts(container, source.id, batch, refs, mode, {
      origin: hooks.origin,
      audit: (action, changes) => hooks.audit(`products_${action}`, changes),
      progress: (percent) => productSpan(index + percent / 100, batches.length),
    })
    productCounts.created += summary.create
    productCounts.updated += summary.update
    productCounts.found += summary.unchanged
    productCounts.skipped += summary.problems
    productCounts.failed += summary.failed
    productRows.push(...rows)
  }
  await keep("product", productCounts)

  const customers = await migrateCustomers(
    container,
    source.id,
    await listOf(source.customers(), beat("customer")),
    apply,
    spanOf(hooks, SPAN.customer)
  )
  problems.push(...customers.problems.map((problem) => ({ ...problem, kind: "customer" as const })))
  await keep("customer", customers.counts)
  await keep("consent", { read: customers.counts.consents, created: customers.counts.consents })

  const orders = await migrateOrders(
    container,
    source.id,
    await listOf(source.orders(), beat("order")),
    customers.ids,
    apply,
    spanOf(hooks, SPAN.order)
  )
  await keep("order", {
    read: orders.read,
    created: orders.added,
    found: orders.read - orders.added,
  })

  const reviews = await migrateReviews(
    container,
    source.id,
    await listOf(source.reviews(), beat("review")),
    new Set(products.map((product) => product.source_key)),
    customers.ids,
    apply,
    spanOf(hooks, SPAN.review)
  )
  problems.push(...reviews.problems.map((problem) => ({ ...problem, kind: "review" as const })))
  await keep("review", reviews.counts)

  // Pages match nothing here: kept for their old addresses, decided with the redirects (F14.7)
  const pages = await listOf(source.pages(), beat("review"))
  if (apply) {
    await migration.remember(
      source.id,
      "page",
      pages.map((page) => ({
        source_key: page.source_key,
        target_id: null,
        status: "skipped" as const,
        old_url: page.old_url,
      }))
    )
  }
  await keep("page", { read: pages.length, skipped: pages.length })
  await hooks.progress(100)
  return { counts, productRows, problems }
}
