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

type Container = Pick<MedusaContainer, "resolve">

/** The source's products as one sheet file, as the catalog import reads one. */
async function sheetOf(products: readonly SourceProduct[], refs: SheetRefs): Promise<Buffer> {
  const rows: SheetCell[][] = [
    migrationSheetHeader(refs.units),
    ...products.flatMap((product) => migrationRows(product, refs)),
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
 * became is kept by the source's key, its old address for a 301.
 */
export async function migrateProducts(
  container: Container,
  source: string,
  products: readonly SourceProduct[],
  refs: SheetRefs,
  mode: "check" | "apply",
  hooks: ImportHooks
): Promise<{
  summary: ImportSummary | null
  rows: SheetCell[][]
  moved: number
  problems: StepProblem[]
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
  let moved = 0
  for (const product of products) {
    if (before.get(product.source_key)?.status === "done") {
      moved += 1
    } else if (held.has(product.handle)) {
      problems.push({ source_key: product.source_key, key: "migration.product_handle_taken" })
    } else {
      fresh.push(product)
    }
  }
  if (fresh.length === 0) {
    return { summary: null, rows: [], moved, problems }
  }
  const result = await runImport(
    container as MedusaContainer,
    await sheetOf(fresh, refs),
    mode,
    hooks
  )
  if (mode === "apply") {
    // Every handle was free before the import: one held now is the product it made
    const found = await catalog.listProducts(
      { handle: fresh.map((product) => product.handle) },
      { select: ["id", "handle"], take: null }
    )
    const ids = new Map(found.map((product) => [product.handle, product.id]))
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
  }
  return { ...result, moved, problems }
}
