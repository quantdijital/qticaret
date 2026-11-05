import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { migrationRows, migrationSheetHeader } from "../../lib/migration/sheet"
import type { SheetRefs } from "../../lib/migration/sheet"
import type { SourceProduct, StepProblem } from "../../lib/migration/types"
import { writeXlsx } from "../../lib/sheets"
import type { SheetCell } from "../../lib/sheets"
import { MIGRATION_MODULE } from "../../modules/migration"
import type MigrationModuleService from "../../modules/migration/service"
import { runImport } from "../catalog/import/run"
import type { ImportHooks, ImportSummary } from "../catalog/import/run"
import { attributeColumns, attributeHeaders, withAttributeCells } from "./attributes"
import type { AttributePlan } from "./attributes"
import { writeDescriptions } from "./descriptions"

type Container = Pick<MedusaContainer, "resolve">

/** The source's products as one sheet file, as the catalog import reads one: their attributes too. */
async function sheetOf(
  products: readonly SourceProduct[],
  refs: SheetRefs,
  plans: ReadonlyMap<string, AttributePlan>
): Promise<Buffer> {
  const columns = attributeColumns(products.map((product) => plans.get(product.source_key)))
  const rows: SheetCell[][] = [
    [...migrationSheetHeader(refs.units), ...attributeHeaders(columns)],
    ...products.flatMap((product) =>
      withAttributeCells(migrationRows(product, refs), plans.get(product.source_key), columns)
    ),
  ]
  const chunks: Buffer[] = []
  for await (const chunk of writeXlsx([{ name: "Ürünler", rows }])) {
    chunks.push(chunk as Buffer)
  }
  return Buffer.concat(chunks)
}

/**
 * The source's products through the catalog import (F14, adr/0042 §2): a
 * dry run checks them as the sheet import checks a file, the real one
 * writes them. Only products not moved before go: one a run moved stays
 * as the shop keeps it now (its price, stock and state are the shop's
 * since), and one whose handle another product here holds is left out
 * and named, never written over (closing review). What each new one
 * became is kept by the source's key, its old address for a 301. A new
 * one's descriptive attributes go in its rows where `plans` give them a
 * template (attributes.ts). A new one's description document (adr/0055)
 * and short description are written once the import made it, and counted. The keys of the ones
 * made (would be, in a dry run) and of the ones a run made before come
 * back for the attributes' counts.
 */
export async function migrateProducts(
  container: Container,
  source: string,
  products: readonly SourceProduct[],
  refs: SheetRefs,
  mode: "check" | "apply",
  hooks: ImportHooks,
  plans: ReadonlyMap<string, AttributePlan> = new Map()
): Promise<{
  summary: ImportSummary | null
  rows: SheetCell[][]
  moved: number
  problems: StepProblem[]
  keys: { made: string[]; moved: string[] }
  /** New ones whose description is (would be) a content document. */
  documents: number
  /** New ones with a short description (would be; adr/0055 Ek 2026-11-06). */
  summaries: number
}> {
  const migration = container.resolve<MigrationModuleService>(MIGRATION_MODULE)
  const catalog = container.resolve(Modules.PRODUCT)
  const before = await migration.targetsOf(
    source,
    "product",
    products.map((product) => product.source_key)
  )
  const held = new Set(
    (
      await catalog.listProducts(
        { handle: products.map((product) => product.handle) },
        { select: ["handle"], take: null }
      )
    ).map((product) => product.handle)
  )
  const fresh: SourceProduct[] = []
  const problems: StepProblem[] = []
  const movedKeys: string[] = []
  for (const product of products) {
    if (before.get(product.source_key)?.status === "done") {
      movedKeys.push(product.source_key)
    } else if (held.has(product.handle)) {
      problems.push({ source_key: product.source_key, key: "migration.product_handle_taken" })
    } else {
      fresh.push(product)
    }
  }
  const moved = movedKeys.length
  if (fresh.length === 0) {
    return {
      summary: null,
      rows: [],
      moved,
      problems,
      keys: { made: [], moved: movedKeys },
      documents: 0,
      summaries: 0,
    }
  }
  const result = await runImport(
    container as MedusaContainer,
    await sheetOf(fresh, refs, plans),
    mode,
    hooks
  )
  // A dry run's: every new one, as the import would make it (its own rows name a refusal)
  let made = fresh.map((product) => product.source_key)
  let documents = fresh.filter((product) => product.description_doc).length
  let summaries = fresh.filter((product) => product.summary_doc).length
  if (mode === "apply") {
    // Every handle was free before the import: one held now is the product it made
    const found = await catalog.listProducts(
      { handle: fresh.map((product) => product.handle) },
      { select: ["id", "handle"], take: null }
    )
    const ids = new Map(found.map((product) => [product.handle, product.id]))
    made = fresh.filter((product) => ids.has(product.handle)).map((product) => product.source_key)
    await migration.remember(
      source,
      "product",
      fresh.map((product) => {
        const id = ids.get(product.handle) ?? null
        return {
          source_key: product.source_key,
          target_id: id,
          status: id ? ("done" as const) : ("failed" as const),
          error_code: id ? null : "migration.product_not_written",
          old_url: product.old_url,
        }
      })
    )
    const written = await writeDescriptions(
      container,
      fresh.flatMap((product) => {
        const id = ids.get(product.handle)
        return id ? [{ product, id }] : []
      })
    )
    documents = written.documents
    summaries = written.summaries
    problems.push(...written.problems)
  }
  return { ...result, moved, problems, keys: { made, moved: movedKeys }, documents, summaries }
}
