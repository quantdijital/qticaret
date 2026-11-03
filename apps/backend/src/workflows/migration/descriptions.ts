import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { descriptionTextOf } from "../../lib/catalog/description"
import { chunksOf } from "../../lib/catalog/ids"
import { errorSummary, logger } from "../../lib/logging"
import type { ContentDoc } from "../../lib/content"
import { MIGRATION_KINDS } from "../../lib/migration/types"
import type {
  MigrationSource,
  SourceProduct,
  StepProblem,
  StepProgress,
} from "../../lib/migration/types"
import type { SheetCell } from "../../lib/sheets"
import { MIGRATION_MODULE } from "../../modules/migration"
import type MigrationModuleService from "../../modules/migration/service"
import { setProductCatalogWorkflow } from "../catalog/set-product-catalog"
import { emptyCounts } from "./report"
import type { KindCounts, ReportProblem, RunCounts } from "./report"

type Container = Pick<MedusaContainer, "resolve">

/**
 * Products' description documents (adr/0055) as a migration writes them:
 * through the catalog save the panel uses, so the plain text the product
 * keeps is the document's own. New products get theirs after the catalog
 * import made them; a refresh run (`refresh: ["descriptions"]`) rewrites
 * only the documents and their text of the products a run moved before.
 */

// Products read at once with their documents
const READ_CHUNK = 200

/** Writes one product's document; a refusal is the record's problem, not the run's. */
async function writeDocument(
  container: Container,
  productId: string,
  doc: ContentDoc,
  sourceKey: string
): Promise<StepProblem | null> {
  try {
    await setProductCatalogWorkflow(container as MedusaContainer).run({
      input: { product_id: productId, description_doc: doc },
    })
    return null
  } catch (error) {
    logger.warn({
      event: "migration.description_failed",
      productId,
      err: errorSummary(error),
    })
    return { source_key: sourceKey, key: "migration.product_description_failed" }
  }
}

/** The documents of the products a run just made, by their new ids. */
export async function writeDescriptions(
  container: Container,
  made: readonly { product: SourceProduct; id: string }[]
): Promise<{ documents: number; problems: StepProblem[] }> {
  let documents = 0
  const problems: StepProblem[] = []
  for (const { product, id } of made) {
    if (!product.description_doc) {
      continue
    }
    const problem = await writeDocument(container, id, product.description_doc, product.source_key)
    if (problem) {
      problems.push(problem)
    } else {
      documents += 1
    }
  }
  return { documents, problems }
}

// A JSON value with its keys in order: Postgres keeps a jsonb's keys in its own order
function canonical(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonical).join(",")}]`
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`
  }
  return JSON.stringify(value)
}

interface Current {
  description: string | null
  doc: unknown
}

async function currentOf(container: Container, ids: readonly string[]) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const found = new Map<string, Current>()
  for (const chunk of chunksOf(ids, READ_CHUNK)) {
    const { data } = await query.graph({
      entity: "product",
      fields: ["id", "description", "product_extension.description_doc"],
      filters: { id: [...chunk] },
    })
    for (const row of data as {
      id: string
      description?: string | null
      product_extension?: { description_doc?: unknown } | null
    }[]) {
      found.set(row.id, {
        description: row.description ?? null,
        doc: row.product_extension?.description_doc ?? null,
      })
    }
  }
  return found
}

/**
 * A refresh run (adr/0055): for each product of the export a run moved
 * before, its document and plain text rewritten from the export, nothing
 * else of it touched. `updated`: refreshed (would be, in a dry run);
 * `found`: already the same; `skipped`: not moved before, or no text in
 * the export (left as it is, named); `failed`: refused or gone since;
 * `documents`: refreshed ones with a document.
 */
export async function refreshDescriptions(
  container: Container,
  sourceId: string,
  products: readonly SourceProduct[],
  apply: boolean,
  progress: StepProgress
): Promise<{ counts: KindCounts; problems: StepProblem[] }> {
  const counts: KindCounts = { ...emptyCounts(), read: products.length, documents: 0 }
  const problems: StepProblem[] = []
  const targets = await container.resolve<MigrationModuleService>(MIGRATION_MODULE).targetsOf(
    sourceId,
    "product",
    products.map((product) => product.source_key)
  )
  const idOf = (product: SourceProduct) => {
    const target = targets.get(product.source_key)
    return target?.status === "done" ? target.target_id : null
  }
  const current = await currentOf(
    container,
    products.flatMap((product) => idOf(product) ?? [])
  )
  for (const [index, product] of products.entries()) {
    await progress(index, products.length)
    const id = idOf(product)
    const now = id ? current.get(id) : undefined
    const doc = product.description_doc ?? null
    if (!id) {
      counts.skipped += 1
    } else if (!now) {
      counts.failed += 1
      problems.push({ source_key: product.source_key, key: "migration.product_gone" })
    } else if (!doc) {
      counts.skipped += 1
      problems.push({ source_key: product.source_key, key: "migration.description_refresh_empty" })
    } else if (
      canonical(now.doc) === canonical(doc) &&
      now.description === descriptionTextOf(doc)
    ) {
      counts.found += 1
    } else {
      const problem = apply ? await writeDocument(container, id, doc, product.source_key) : null
      if (problem) {
        counts.failed += 1
        problems.push(problem)
      } else {
        counts.updated += 1
        counts.documents = (counts.documents ?? 0) + 1
      }
    }
  }
  await progress(products.length, products.length)
  return { counts, problems }
}

/**
 * A refresh run's whole work: the source's products read, their
 * descriptions refreshed; every other kind counts nothing. The product
 * counts are kept with the run as a run's are.
 */
export async function runDescriptionRefresh(
  container: Container,
  source: MigrationSource,
  runId: string,
  mode: "check" | "apply",
  progress: (percent: number) => Promise<void>
): Promise<{ counts: RunCounts; productRows: SheetCell[][]; problems: ReportProblem[] }> {
  const products: SourceProduct[] = []
  for await (const product of source.products()) {
    products.push(product)
  }
  const refreshed = await refreshDescriptions(
    container,
    source.id,
    products,
    mode === "apply",
    (done, total) => progress(5 + (total > 0 ? done / total : 1) * 95)
  )
  const counts = Object.fromEntries(
    [...MIGRATION_KINDS, "consent", "attribute"].map((kind) => [kind, emptyCounts()])
  ) as RunCounts
  counts.product = refreshed.counts
  await container
    .resolve<MigrationModuleService>(MIGRATION_MODULE)
    .count(runId, "product", { ...refreshed.counts })
  await progress(100)
  return {
    counts,
    productRows: [],
    problems: refreshed.problems.map((problem) => ({ ...problem, kind: "product" as const })),
  }
}
