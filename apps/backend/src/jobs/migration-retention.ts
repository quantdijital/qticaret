import type { MedusaContainer } from "@medusajs/framework/types"
import { logger } from "../lib/logging"
import { forgetMovedCustomers } from "../workflows/migration/retention"

/** The moved customers' migration records, forgotten after cutover (F14, KVKK). */
export default async function migrationRetention(container: MedusaContainer) {
  const forgotten = await forgetMovedCustomers(container)
  if (forgotten > 0) {
    logger.info({ event: "migration.customers_forgotten", count: forgotten })
  }
}

export const config = {
  name: "migration-retention",
  schedule: "40 3 * * *",
}
