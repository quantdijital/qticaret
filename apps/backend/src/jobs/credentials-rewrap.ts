import type { MedusaContainer } from "@medusajs/framework/types"
import { logger } from "../lib/logging"
import { INTEGRATION_CREDENTIALS_MODULE } from "../modules/integration-credentials"
import { logCredentialFailure } from "../modules/integration-credentials/safe-log"
import type IntegrationCredentialsModuleService from "../modules/integration-credentials/service"
import { rewrapCredentialsWorkflow } from "../workflows/integration-credentials/rewrap-credentials"

/**
 * The provider accounts' hourly upkeep (adr/0061 Ek C17): rows still in
 * adr/0027's format are sealed as envelopes. It never moves a row between
 * KEKs (review L1): a process left on an older key order would wrap rows
 * back under the key the operator is about to remove. KEK moves are
 * `credentials:keys rewrap`, run from the updated config.
 *
 * What it finds is said every hour, fingerprints and counts only: rows
 * under a key that is not configured (`kek_missing`, unreadable until the
 * key is back) and rows under a configured key this process does not put
 * first (`kek_order_conflict`: a rotation waiting for its rewrap, or this
 * process's config is behind).
 */
export default async function credentialsRewrapJob(container: MedusaContainer): Promise<void> {
  const credentials = container.resolve<IntegrationCredentialsModuleService>(
    INTEGRATION_CREDENTIALS_MODULE
  )
  try {
    const before = await credentials.keyStatus()
    const counted = (state: string) =>
      before.keys
        .filter((key) => key.state === state && key.records > 0)
        .map((key) => ({ kek_id: key.kek_id, records: key.records }))
    if (before.stranded > 0) {
      logger.error({
        event: "integration_credentials.kek_missing",
        kek_ids: counted("missing").map((key) => key.kek_id),
        records: before.stranded,
      })
    }
    const older = counted("older")
    if (older.length > 0) {
      logger.warn({
        event: "integration_credentials.kek_order_conflict",
        current: before.kek_ids[0] ?? null,
        older,
      })
    }
    if (!before.configured || counted("legacy").length === 0) {
      return
    }
    const { result } = await rewrapCredentialsWorkflow(container).run({
      input: { legacy_only: true },
    })
    logger.info({
      event: "integration_credentials.rewrap_done",
      rewrapped: result.rewrapped,
      upgraded: result.upgraded,
      failed: result.failed,
      stranded: result.stranded,
    })
  } catch (error) {
    // By code alone: a database error's message carries its SQL and values
    logCredentialFailure("error", "integration_credentials.rewrap_failed", error)
  }
}

export const config = {
  name: "integration-credentials-rewrap",
  schedule: "23 * * * *",
}
