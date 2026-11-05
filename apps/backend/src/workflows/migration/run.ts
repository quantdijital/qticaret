import type { MedusaContainer } from "@medusajs/framework/types"
import { packageOf } from "../../lib/migration/sheet"
import type { PackageDefaults, SourceProduct, StepProgress } from "../../lib/migration/types"
import type { MigrationSource } from "../../lib/migration/types"
import type { SheetCell } from "../../lib/sheets"
import { MIGRATION_MODULE } from "../../modules/migration"
import type MigrationModuleService from "../../modules/migration/service"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import type { StoreSettings } from "../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"
import type { ImportHooks } from "../catalog/import/run"
import { attributeOutcome } from "./attribute-report"
import { planProductAttributes } from "./attributes"
import { factsOutcome } from "./description-facts"
import type { AttributedProduct } from "./attributes"
import { migrateBrands } from "./brands"
import { migrateCategories } from "./categories"
import { migrateContent } from "./content"
import { migrateCustomers, migrateOrders } from "./customers"
import { migrateImages } from "./images"
import { migrateProducts } from "./products"
import { emptyCounts } from "./report"
import type { KindCounts, ReportProblem, RunCounts } from "./report"
import { migrateReviews } from "./reviews"
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
  image: [50, 70],
  customer: [70, 82],
  order: [82, 88],
  review: [88, 93],
  content: [93, 99],
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
 * in groups, with the descriptive attributes the shop's templates take
 * (attributes.ts), and their pictures, then customers, their old orders and the reviews, then
 * blog posts and content pages (those without their own text kept for
 * their addresses, F14.7). A product keeps the source's status; one
 * without its measurements takes the owner's `defaults` when given, else
 * goes without (shipping uses the shop's default parcel, adr/0054); each
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

  // What the source left out as it read
  problems.push(...(source.notes?.() ?? []))
  const categories = await listOf(source.categories(), beat("category"))
  const tree = await migrateCategories(
    container,
    source.id,
    categories,
    apply,
    spanOf(hooks, SPAN.category)
  )
  problems.push(...tree.problems.map((problem) => ({ ...problem, kind: "category" as const })))
  await keep("category", tree.counts)

  const brands = await migrateBrands(
    container,
    source.id,
    await listOf(source.brands(), beat("brand")),
    apply,
    spanOf(hooks, SPAN.brand)
  )
  await keep("brand", brands.counts)

  const products: AttributedProduct[] = await listOf(source.products(), beat("product"))
  const attributePlans = await planProductAttributes(container, products)
  const settings = (await container
    .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    .getSection("store")) as unknown as StoreSettings
  const refs = {
    units: { weight: settings.weight_unit, dimension: settings.dimension_unit },
    categoryHandle: tree.handleOf,
    brandHandle: brands.handleOf,
    defaults,
  }
  // Measures are optional (adr/0054): each product without them is named, live or not
  for (const product of products) {
    const pack = packageOf(product, defaults)
    const key = pack.defaulted
      ? "migration.product_parcel_defaulted"
      : !pack.complete
        ? "migration.product_no_parcel"
        : null
    if (key) {
      problems.push({ kind: "product", source_key: product.source_key, key })
    }
  }
  const productRows: SheetCell[][] = []
  const productCounts = counted({ read: products.length })
  // adr/0055: only a source that gives documents counts them
  const givesDocuments = products.some((product) => product.description_doc !== undefined)
  if (givesDocuments) {
    productCounts.documents = 0
  }
  // adr/0055 Ek 2026-11-06: likewise a source that keeps short descriptions
  const givesSummaries = products.some((product) => product.summary_doc !== undefined)
  if (givesSummaries) {
    productCounts.summaries = 0
  }
  const made = new Set<string>()
  const moved = new Set<string>()
  const batches = batchesOf(products)
  const productSpan = spanOf(hooks, SPAN.product)
  for (const [index, batch] of batches.entries()) {
    const outcome = await migrateProducts(
      container,
      source.id,
      batch,
      refs,
      mode,
      {
        origin: hooks.origin,
        audit: (action, changes) => hooks.audit(`products_${action}`, changes),
        progress: (percent) => productSpan(index + percent / 100, batches.length),
      },
      attributePlans
    )
    const { summary, rows, problems: left } = outcome
    outcome.keys.made.forEach((key) => made.add(key))
    outcome.keys.moved.forEach((key) => moved.add(key))
    productCounts.created += summary?.create ?? 0
    productCounts.updated += summary?.update ?? 0
    productCounts.found += (summary?.unchanged ?? 0) + outcome.moved
    productCounts.skipped += (summary?.problems ?? 0) + left.length
    productCounts.failed += summary?.failed ?? 0
    if (givesDocuments) {
      productCounts.documents = (productCounts.documents ?? 0) + outcome.documents
    }
    if (givesSummaries) {
      productCounts.summaries = (productCounts.summaries ?? 0) + outcome.summaries
    }
    productRows.push(...rows)
    problems.push(...left.map((problem) => ({ ...problem, kind: "product" as const })))
  }
  await keep("product", productCounts)
  const attributes = attributeOutcome(products, attributePlans, made, moved)
  // adr/0013 Ek 2026-11-05: what the descriptions stated, for a source that gives documents
  const facts = givesDocuments
    ? factsOutcome(
        products.map((product) => ({
          source_key: product.source_key,
          facts: attributePlans.get(product.source_key)?.facts,
        })),
        made
      )
    : null
  problems.push(...attributes.problems, ...(facts?.problems ?? []))
  await keep("attribute", { ...attributes.counts, ...facts?.counts })

  const images = await migrateImages(
    container,
    source.id,
    products,
    apply,
    spanOf(hooks, SPAN.image)
  )
  problems.push(...images.problems.map((problem) => ({ ...problem, kind: "image" as const })))
  await keep("image", images.counts)

  const customers = await migrateCustomers(
    container,
    source.id,
    runId,
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

  // Posts and pages with their own text are written; the rest keep their old addresses (F14.7)
  const content = await migrateContent(
    container,
    source.id,
    source.posts ? await listOf(source.posts(), beat("content")) : [],
    await listOf(source.pages(), beat("content")),
    apply,
    spanOf(hooks, SPAN.content)
  )
  problems.push(...content.problems)
  for (const kind of ["post_category", "post_tag", "post", "page"] as const) {
    await keep(kind, content.counts[kind])
  }
  if (apply) {
    // Every old address the records had, for the 301s (F14.7)
    await inventoryFromItems(container, source.id)
  }
  await hooks.progress(100)
  return { counts, productRows, problems }
}
