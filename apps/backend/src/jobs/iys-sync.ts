import type { MedusaContainer } from "@medusajs/framework/types"
import { logger } from "../lib/logging"
import { syncIysWorkflow } from "../workflows/messaging/iys-sync"

/** Consents a run sends at most; the rest wait for the next. */
const BATCH = 200

/**
 * Tells İYS of changed consents (F10 M11, adr/0038 §2). The law gives a
 * business three working days to upload a consent; every ten minutes
 * keeps well inside it.
 */
export default async function iysSync(container: MedusaContainer) {
  const { result } = await syncIysWorkflow(container).run({ input: { limit: BATCH } })
  if (result.sent + result.failed > 0) {
    logger.info({ event: "messaging.iys_synced", sent: result.sent, failed: result.failed })
  }
}

export const config = {
  name: "iys-sync",
  schedule: "*/10 * * * *",
}
