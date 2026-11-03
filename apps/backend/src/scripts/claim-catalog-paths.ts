import type { ExecArgs, MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { isValidationError } from "../lib/errors"
import { logger } from "../lib/logging"
import {
  claimCategoryPaths,
  claimCollectionPaths,
  claimProductPaths,
} from "../workflows/catalog/entity-paths"

type Check = (container: MedusaContainer, id: string) => Promise<unknown>

// Each record on its own: one bad handle does not hold the others back
const CHECKS: readonly [string, string, Check][] = [
  [
    "product_category",
    "path",
    (container, id) => claimCategoryPaths(container, [id], { subtree: false }),
  ],
  ["product", "path", (container, id) => claimProductPaths(container, [id])],
  ["product_collection", "path", (container, id) => claimCollectionPaths(container, [id])],
]

/**
 * Usage: pnpm --filter @qticaret/backend medusa exec ./src/scripts/claim-catalog-paths.ts
 *
 * Brings records made before F3.1 in line, once per database (a deploy step):
 * claims their storefront paths in the URL registry; the workflow hooks do
 * it for every save since. (Weight and measures are optional, adr/0054:
 * nothing to check there.) Safe to run again: a record that holds its path is left alone. Records
 * that fail a check are listed by ID with the reason and skipped.
 */
export default async function run({ container }: ExecArgs): Promise<void> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  for (const [entity, check, apply] of CHECKS) {
    const { data } = await query.graph({ entity, fields: ["id"], filters: {} })
    const ids = (data as { id: string }[]).map((row) => row.id)
    const skipped: { id: string; reason: string }[] = []
    for (const id of ids) {
      try {
        await apply(container, id)
      } catch (error) {
        if (!isValidationError(error)) {
          throw error
        }
        skipped.push({ id, reason: error.safeMessage })
      }
    }
    logger.info(
      { event: "catalog.records_checked", entity, check, records: ids.length, skipped },
      "checked catalog records"
    )
  }
}
