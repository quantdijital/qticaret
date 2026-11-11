import type { MedusaContainer } from "@medusajs/framework/types"
import { errorSummary, logger } from "../lib/logging"
import { INTEGRATION_CREDENTIALS_MODULE } from "../modules/integration-credentials"
import type IntegrationCredentialsModuleService from "../modules/integration-credentials/service"
import { rewrapCredentialsWorkflow } from "../workflows/integration-credentials/rewrap-credentials"

/**
 * The credentials KEK rotation's background job (adr/0061 Ek C17): hourly,
 * when rows wait under an older configured key or in adr/0027's format,
 * they are moved to the current key. Rows under a key that is no longer
 * configured are said loudly every hour: they cannot be opened until the
 * key is put back. Counts and fingerprints only.
 */
export default async function credentialsRewrapJob(container: MedusaContainer): Promise<void> {
  const credentials = container.resolve<IntegrationCredentialsModuleService>(
    INTEGRATION_CREDENTIALS_MODULE
  )
  try {
    const before = await credentials.keyStatus()
    if (before.stranded > 0) {
      logger.error({
        event: "integration_credentials.kek_missing",
        kek_ids: before.keys.filter((key) => key.state === "missing").map((key) => key.kek_id),
        records: before.stranded,
      })
    }
    if (!before.configured || before.pending === 0) {
      return
    }
    const { result } = await rewrapCredentialsWorkflow(container).run({ input: {} })
    logger.info({
      event: "integration_credentials.rewrap_done",
      rewrapped: result.rewrapped,
      upgraded: result.upgraded,
      failed: result.failed,
      stranded: result.stranded,
    })
  } catch (error) {
    logger.error({ event: "integration_credentials.rewrap_failed", err: errorSummary(error) })
  }
}

export const config = {
  name: "integration-credentials-rewrap",
  schedule: "23 * * * *",
}
