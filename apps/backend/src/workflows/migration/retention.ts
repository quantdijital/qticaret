import type { MedusaContainer } from "@medusajs/framework/types"
import { CLAIM_DAYS } from "../../lib/migration/claim"
import { MIGRATION_MODULE } from "../../modules/migration"
import type MigrationModuleService from "../../modules/migration/service"
import { currentCutover } from "./watch"

type Container = Pick<MedusaContainer, "resolve">

/** How long after cutover the moved customers' records are kept (docs/kvkk-envanter.md). */
export const KEEP_DAYS = 90
const DAY_MS = 24 * 60 * 60 * 1000
const BATCH = 500

/**
 * The moved customers' migration records, forgotten once they are no
 * longer needed (KVKK): their key can be an address. Kept until ninety
 * days after cutover, and while an invitation's key may still be used;
 * products' and categories' records hold nothing of a person and stay.
 * How many were forgotten.
 */
export async function forgetMovedCustomers(container: Container, now: Date = new Date()) {
  const cutover = await currentCutover(container)
  if (!cutover || now.getTime() < cutover.cutover_at.getTime() + KEEP_DAYS * DAY_MS) {
    return 0
  }
  const migration = container.resolve<MigrationModuleService>(MIGRATION_MODULE)
  const invitedBefore = new Date(now.getTime() - CLAIM_DAYS * DAY_MS)
  let forgotten = 0
  for (;;) {
    const items = await migration.listMigrationItems(
      {
        kind: "customer",
        $or: [{ invited_at: null }, { invited_at: { $lt: invitedBefore } }],
      },
      { select: ["id"], take: BATCH }
    )
    if (items.length === 0) {
      return forgotten
    }
    await migration.deleteMigrationItems(items.map((item) => item.id))
    forgotten += items.length
  }
}
