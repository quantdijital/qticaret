import type { MedusaContainer } from "@medusajs/framework/types"
import { packageOf } from "../../lib/migration/sheet"
import type { SheetRefs } from "../../lib/migration/sheet"
import type { PackageDefaults, StepProgress } from "../../lib/migration/types"
import type { SheetCell } from "../../lib/sheets"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import type { StoreSettings } from "../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"
import type { ImportHooks } from "../catalog/import/run"
import { attributeOutcome } from "./attribute-report"
import { planProductAttributes } from "./attributes"
import type { AttributedProduct } from "./attributes"
import { factsOutcome } from "./description-facts"
import { batchesOf, migrateProducts } from "./products"
import { emptyCounts } from "./report"
import type { KindCounts, ReportProblem } from "./report"

type Container = Pick<MedusaContainer, "resolve">

export interface ProductStepHooks {
  /** `done` products of `total`, as the batches go. */
  progress: StepProgress
  audit: (action: string, changes: Record<string, unknown>) => Promise<void>
  origin: ImportHooks["origin"]
}

/**
 * A run's products (F14, adr/0042): through the catalog import in groups,
 * with the descriptive attributes the shop's templates take (attributes.ts)
 * and the facts their descriptions stated; each without its measurements
 * named in the report, with the owner's `defaults` when given (adr/0054).
 */
export async function moveProducts(
  container: Container,
  sourceId: string,
  products: AttributedProduct[],
  handles: Pick<SheetRefs, "categoryHandle" | "brandHandle">,
  mode: "check" | "apply",
  defaults: PackageDefaults | null,
  hooks: ProductStepHooks
): Promise<{
  product: KindCounts
  attribute: KindCounts
  rows: SheetCell[][]
  problems: ReportProblem[]
}> {
  const problems: ReportProblem[] = []
  const attributePlans = await planProductAttributes(container, products)
  const settings = (await container
    .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    .getSection("store")) as unknown as StoreSettings
  const refs: SheetRefs = {
    units: { weight: settings.weight_unit, dimension: settings.dimension_unit },
    ...handles,
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
  const rows: SheetCell[][] = []
  const counts: KindCounts = { ...emptyCounts(), read: products.length }
  // adr/0055: only a source that gives documents counts them
  const givesDocuments = products.some((product) => product.description_doc !== undefined)
  if (givesDocuments) {
    counts.documents = 0
  }
  // adr/0055 Ek 2026-11-06: likewise a source that keeps short descriptions
  const givesSummaries = products.some((product) => product.summary_doc !== undefined)
  if (givesSummaries) {
    counts.summaries = 0
  }
  const made = new Set<string>()
  const moved = new Set<string>()
  const batches = batchesOf(products)
  await hooks.progress(0, products.length)
  let before = 0
  for (const batch of batches) {
    const outcome = await migrateProducts(
      container,
      sourceId,
      batch,
      refs,
      mode,
      {
        origin: hooks.origin,
        audit: (action, changes) => hooks.audit(`products_${action}`, changes),
        progress: (percent) =>
          hooks.progress(before + Math.round((percent / 100) * batch.length), products.length),
      },
      attributePlans
    )
    before += batch.length
    const { summary, rows: batchRows, problems: left } = outcome
    outcome.keys.made.forEach((key) => made.add(key))
    outcome.keys.moved.forEach((key) => moved.add(key))
    counts.created += summary?.create ?? 0
    counts.updated += summary?.update ?? 0
    counts.found += (summary?.unchanged ?? 0) + outcome.moved
    counts.skipped += (summary?.problems ?? 0) + left.length
    counts.failed += summary?.failed ?? 0
    if (givesDocuments) {
      counts.documents = (counts.documents ?? 0) + outcome.documents
    }
    if (givesSummaries) {
      counts.summaries = (counts.summaries ?? 0) + outcome.summaries
    }
    rows.push(...batchRows)
    problems.push(...left.map((problem) => ({ ...problem, kind: "product" as const })))
  }
  await hooks.progress(products.length, products.length)
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
  return {
    product: counts,
    attribute: { ...emptyCounts(), ...attributes.counts, ...facts?.counts },
    rows,
    problems,
  }
}
