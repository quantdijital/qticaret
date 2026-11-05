import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { chunksOf } from "../../lib/catalog/ids"
import { summaryOf } from "../../lib/catalog/summary"
import type { SourceProduct, StepProblem } from "../../lib/migration/types"
import { MIGRATION_MODULE } from "../../modules/migration"
import type MigrationModuleService from "../../modules/migration/service"
import { writeTexts } from "./descriptions"

type Container = Pick<MedusaContainer, "resolve">

/**
 * Short descriptions (adr/0055 Ek 2026-11-05) for the products a run
 * moved before they were imported: each product of the source a run made
 * gets its lines, only where it has none (the shop's own are never
 * written over). Through the catalog save, as the panel's. Safe to run
 * again: a filled one is found, not written.
 */

const READ_CHUNK = 200

export interface SummaryFill {
  /** Products in the source. */
  read: number
  /** Filled (would be, in a dry run). */
  updated: number
  /** Already have lines here: left as they are. */
  found: number
  /** Not moved by a run (or not done). */
  skipped: number
  /** No short description in the source. */
  empty: number
  /** Gone since, or the save refused. */
  failed: number
  problems: StepProblem[]
}

async function currentSummaries(container: Container, ids: readonly string[]) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const found = new Map<string, string[]>()
  for (const chunk of chunksOf(ids, READ_CHUNK)) {
    const { data } = await query.graph({
      entity: "product",
      fields: ["id", "product_extension.summary"],
      filters: { id: [...chunk] },
    })
    for (const row of data as { id: string; product_extension?: { summary?: unknown } | null }[]) {
      found.set(row.id, summaryOf(row.product_extension?.summary))
    }
  }
  return found
}

export async function fillSummaries(
  container: Container,
  sourceId: string,
  products: readonly SourceProduct[],
  apply: boolean
): Promise<SummaryFill> {
  const fill: SummaryFill = {
    read: products.length,
    updated: 0,
    found: 0,
    skipped: 0,
    empty: 0,
    failed: 0,
    problems: [],
  }
  const targets = await container.resolve<MigrationModuleService>(MIGRATION_MODULE).targetsOf(
    sourceId,
    "product",
    products.map((product) => product.source_key)
  )
  const idOf = (product: SourceProduct) => {
    const target = targets.get(product.source_key)
    return target?.status === "done" ? target.target_id : null
  }
  const current = await currentSummaries(
    container,
    products.flatMap((product) => idOf(product) ?? [])
  )
  for (const product of products) {
    const lines = product.summary ?? []
    const id = idOf(product)
    const now = id ? current.get(id) : undefined
    if (lines.length === 0) {
      fill.empty += 1
    } else if (!id) {
      fill.skipped += 1
    } else if (!now) {
      fill.failed += 1
      fill.problems.push({ source_key: product.source_key, key: "migration.product_gone" })
    } else if (now.length > 0) {
      fill.found += 1
    } else {
      const problem = apply
        ? await writeTexts(container, id, { summary: lines }, product.source_key)
        : null
      if (problem) {
        fill.failed += 1
        fill.problems.push(problem)
      } else {
        fill.updated += 1
      }
    }
  }
  return fill
}
