import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import { ProviderError } from "../../lib/errors"
import { errorSummary, logger } from "../../lib/logging"
import { iysAccountOf, iysRecordOf, netgsmIysApi } from "../../lib/messaging/sms/netgsm-iys"
import { INTEGRATION_CREDENTIALS_MODULE } from "../../modules/integration-credentials"
import type IntegrationCredentialsModuleService from "../../modules/integration-credentials/service"
import { MESSAGING_MODULE } from "../../modules/messaging"
import type MessagingModuleService from "../../modules/messaging/service"

// Netgsm's refusals of the account itself (login, brand code): every row would fail alike
const ACCOUNT_REFUSALS = new Set(["iys_30", "iys_40"])

/**
 * Tells İYS of the consents that changed, oldest first, through the
 * shop's Netgsm account and its brand code (F10 M11, adr/0038 §2). Each
 * row is marked with what İYS made of it. A refusal of the account, or
 * İYS out of reach, stops the run and leaves the rest waiting. Nothing to
 * undo: İYS takes the same consent again without change, and a row is
 * marked only after its answer.
 */
const syncIysStep = createStep(
  "messaging-sync-iys",
  async (input: { limit: number }, { container }) => {
    const account = iysAccountOf(
      await container
        .resolve<IntegrationCredentialsModuleService>(INTEGRATION_CREDENTIALS_MODULE)
        .read("netgsm")
    )
    if (!account) {
      return new StepResponse({ sent: 0, failed: 0, waiting: true })
    }
    const messaging = container.resolve<MessagingModuleService>(MESSAGING_MODULE)
    const rows = await messaging.listMessageConsents(
      { iys_status: "pending" },
      {
        take: input.limit,
        order: { changed_at: "ASC" },
        select: ["id", "channel", "status", "source", "changed_at", "recipient_encrypted"],
      }
    )
    let sent = 0
    let failed = 0
    for (const row of rows) {
      const address = messaging.iysAddressOf(row)
      const record = address ? iysRecordOf(row, address) : null
      if (!record) {
        await messaging.markIys(row.id, row.changed_at, {
          status: "failed",
          error: address ? "not_taken" : "no_address",
        })
        failed += 1
        continue
      }
      try {
        await netgsmIysApi().add(account, record)
        await messaging.markIys(row.id, row.changed_at, { status: "sent" })
        sent += 1
      } catch (error) {
        const refused = error instanceof ProviderError && !error.retryable
        if (refused && !ACCOUNT_REFUSALS.has(error.providerCode)) {
          await messaging.markIys(row.id, row.changed_at, {
            status: "failed",
            error: error.providerCode,
          })
          failed += 1
          continue
        }
        logger.warn({ event: "messaging.iys_stopped", err: errorSummary(error) })
        break
      }
    }
    return new StepResponse({ sent, failed, waiting: false })
  }
)

/** Consents İYS has not heard of yet, sent to it (F10 M11). */
export const syncIysWorkflow = createWorkflow(
  "messaging-sync-iys",
  (input: { limit: number }) => new WorkflowResponse(syncIysStep(input))
)
