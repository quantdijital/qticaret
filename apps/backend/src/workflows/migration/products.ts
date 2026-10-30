import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { migrationRows, migrationSheetHeader } from "../../lib/migration/sheet"
import type { SheetRefs } from "../../lib/migration/sheet"
import type { SourceProduct } from "../../lib/migration/types"
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
 * writes them by handle (a product met again is updated, not made twice).
 * What each became is kept by the source's key, its old address for a
 * 301. Returns the import's summary and its report rows.
 */
export async function migrateProducts(
  container: Container,
  source: string,
  products: readonly SourceProduct[],
  refs: SheetRefs,
  mode: "check" | "apply",
  hooks: ImportHooks
): Promise<{ summary: ImportSummary; rows: SheetCell[][] }> {
  const result = await runImport(
    container as MedusaContainer,
    await sheetOf(products, refs),
    mode,
    hooks
  )
  if (mode === "apply" && products.length > 0) {
    const found = await container
      .resolve(Modules.PRODUCT)
      .listProducts(
        { handle: products.map((product) => product.handle) },
        { select: ["id", "handle"], take: null }
      )
    const ids = new Map(found.map((product) => [product.handle, product.id]))
    await container.resolve<MigrationModuleService>(MIGRATION_MODULE).remember(
      source,
      "product",
      products.map((product) => {
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
  return result
}
