import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { errorSummary, logger } from "../lib/logging"
import { PAYTR_PAYMENT_PROVIDER_ID } from "../lib/payments/checkout"
import { paytrApi, paytrCredentialsOf } from "../lib/payments/paytr"
import { INTEGRATION_CREDENTIALS_MODULE } from "../modules/integration-credentials"
import type IntegrationCredentialsModuleService from "../modules/integration-credentials/service"
import { paytrNotificationWorkflow } from "../workflows/payments/paytr-notification"

// Past the token's 30 minutes and PayTR's first retries; within a day it is still worth asking
const QUIET_MS = 10 * 60 * 1000
const GIVE_UP_MS = 24 * 60 * 60 * 1000
const BATCH = 100

/**
 * PayTR payments whose notification never came (adr/0026 §7): open
 * sessions are asked about, and one PayTR shows paid goes through the same
 * workflow as its notification would. The event key is the same, so a
 * notification arriving too is handled once.
 */
export async function reconcilePaytrSessions(
  container: MedusaContainer,
  options: { quietMs?: number } = {}
): Promise<number> {
  const account = paytrCredentialsOf(
    await container
      .resolve<IntegrationCredentialsModuleService>(INTEGRATION_CREDENTIALS_MODULE)
      .read("paytr")
  )
  if (!account) {
    return 0
  }
  const now = Date.now()
  const sessions = await container.resolve(Modules.PAYMENT).listPaymentSessions(
    {
      provider_id: PAYTR_PAYMENT_PROVIDER_ID,
      created_at: {
        $lte: new Date(now - (options.quietMs ?? QUIET_MS)).toISOString(),
        $gte: new Date(now - GIVE_UP_MS).toISOString(),
      },
    },
    { select: ["id", "status", "data"], take: BATCH, order: { created_at: "ASC" } }
  )
  // The status is not a filter Medusa takes: the open ones are picked here
  let placed = 0
  for (const session of sessions.filter(({ status }) => status === "pending")) {
    const merchantOid = session.data["merchant_oid"]
    if (typeof merchantOid !== "string") {
      continue
    }
    try {
      const paid = await paytrApi().queryStatus(account, merchantOid)
      if (!paid) {
        continue
      }
      await paytrNotificationWorkflow(container).run({
        input: {
          merchant_oid: merchantOid,
          status: "success",
          total_amount: paid.totalAmount,
          test_mode: paid.testMode,
          failed_reason_code: null,
        },
      })
      placed += 1
    } catch (error) {
      logger.warn({
        event: "paytr.reconcile_failed",
        sessionId: session.id,
        err: errorSummary(error),
      })
    }
  }
  if (placed > 0) {
    logger.info({ event: "paytr.reconcile", placed })
  }
  return placed
}

export default async function paytrReconcile(container: MedusaContainer) {
  await reconcilePaytrSessions(container)
}

export const config = {
  name: "paytr-reconcile",
  schedule: "*/10 * * * *",
}
