import type { MedusaContainer } from "@medusajs/framework/types"
import { isProviderError } from "../../errors"
import { errorSummary, logger } from "../../logging"
import { MESSAGING_MODULE } from "../../../modules/messaging"
import type MessagingModuleService from "../../../modules/messaging/service"

type Container = Pick<MedusaContainer, "resolve">

/**
 * A mail server's permanent "no such mailbox" (`recipient_rejected`, see
 * `smtp-errors.ts`) is a hard bounce said at once: the address goes on the
 * suppression list, as Resend's `email.bounced` report puts it there
 * (adr/0036 §6, Ek 2026-11-10), and nothing goes to it again. The send
 * still fails, so the notification stays FAILURE. A list that cannot be
 * written is logged; the send's own failure is what the caller sees.
 */
export async function suppressRefusedRecipient<T>(
  container: Container,
  to: string,
  send: () => Promise<T>
): Promise<T> {
  try {
    return await send()
  } catch (error) {
    if (isProviderError(error) && error.providerCode === "recipient_rejected") {
      try {
        const messaging = container.resolve<MessagingModuleService>(MESSAGING_MODULE)
        if (messaging.recipientOf("email", to)) {
          await messaging.suppress({
            channel: "email",
            address: to,
            reason: "bounce",
            source: "smtp",
            // The reply's numbers (`550 5.1.1`), never its words
            detail: error.providerMessage ?? null,
          })
        }
      } catch (failure) {
        logger.warn({ event: "messaging.smtp_bounce_not_kept", err: errorSummary(failure) })
      }
    }
    throw error
  }
}
