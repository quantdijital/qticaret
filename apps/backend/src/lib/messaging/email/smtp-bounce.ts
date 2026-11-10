import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { isProviderError } from "../../errors"
import { errorSummary, logger } from "../../logging"
import { MESSAGING_MODULE } from "../../../modules/messaging"
import type MessagingModuleService from "../../../modules/messaging/service"
import { BREAKER, smtpBreaker } from "./smtp-breaker"
import type { SmtpBreaker } from "./smtp-breaker"

type Container = Pick<MedusaContainer, "resolve">

/** The event the alarm's subscriber hears (`subscribers/smtp-rejections-alarm.ts`). */
export const SMTP_REJECTIONS_EVENT = "messaging.smtp_rejections_tripped"

const REMOVED_BY = "system:smtp_breaker"

/**
 * A mail server's permanent "no such mailbox" (`recipient_rejected`, see
 * `smtp-errors.ts`) is a hard bounce said at once: the address goes on the
 * suppression list, as Resend's `email.bounced` report puts it there
 * (adr/0036 §6, Ek 2026-11-10), and nothing goes to it again; unless the
 * server is refusing too much to be believed (`smtp-breaker.ts`), when the
 * window's suppressions are taken back and the shop is told through an
 * event. The send still fails, so the notification stays FAILURE. A list
 * that cannot be written is logged; the send's own failure is what the
 * caller sees. Only SMTP sends are counted (`smtp`).
 */
export async function suppressRefusedRecipient<T>(
  container: Container,
  to: string,
  send: () => Promise<T>,
  { smtp = true, breaker = smtpBreaker }: { smtp?: boolean; breaker?: SmtpBreaker } = {}
): Promise<T> {
  try {
    const result = await send()
    if (smtp) {
      breaker.record("sent")
    }
    return result
  } catch (error) {
    const refused = isProviderError(error) && error.providerCode === "recipient_rejected"
    if (!smtp) {
      throw error
    }
    const verdict = breaker.record(refused ? "rejected" : "failed")
    try {
      const messaging = container.resolve<MessagingModuleService>(MESSAGING_MODULE)
      if (verdict.suppress && isProviderError(error) && messaging.recipientOf("email", to)) {
        const kept = await messaging.suppress({
          channel: "email",
          address: to,
          reason: "bounce",
          source: "smtp",
          // The reply's numbers (`550 5.1.1`), never its words
          detail: error.providerMessage ?? null,
        })
        if (kept.created) {
          breaker.noteSuppression(kept.id)
        }
      }
      if (verdict.tripped) {
        logger.error({
          event: SMTP_REJECTIONS_EVENT,
          rejections: verdict.rejections,
          sends: verdict.sends,
          undone: verdict.undo.length,
        })
        // One row gone meanwhile (taken off by staff) does not keep the others on
        for (const id of verdict.undo) {
          await messaging.unsuppress(id, REMOVED_BY).catch((failure: unknown) => {
            logger.warn({ event: "messaging.smtp_bounce_not_undone", err: errorSummary(failure) })
          })
        }
        await container.resolve(Modules.EVENT_BUS).emit({
          name: SMTP_REJECTIONS_EVENT,
          data: {
            rejections: verdict.rejections,
            sends: verdict.sends,
            minutes: BREAKER.windowMs / 60_000,
          },
        })
      }
    } catch (failure) {
      logger.warn({ event: "messaging.smtp_bounce_not_kept", err: errorSummary(failure) })
    }
    throw error
  }
}
