import { randomUUID } from "node:crypto"
import { Modules } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import { ValidationError, isProviderError } from "../../lib/errors"
import { errorSummary, logger } from "../../lib/logging"
import { tenantTag } from "../../lib/messaging/email"
import { shopSmtpAccount } from "../../lib/messaging/email/shop-transport"
import { createSmtpTransport } from "../../lib/messaging/email/smtp"
import type { SmtpFailure } from "../../lib/messaging/email/smtp-errors"
import { maskRecipient, normalizeRecipient } from "../../lib/messaging/recipients"
import { renderEmail } from "../../lib/messaging/templates/layout"
import { messageText } from "../../lib/messaging/texts"
import { brandOf } from "./brand"

/** What the panel shows: sent, or why not in words of its own and the server's numbers. */
export type SmtpTestResult =
  | { ok: true; to: string }
  | { ok: false; reason: SmtpFailure | "aborted" | "invalid_address"; reply: string | null }

// A person waits at the panel: one try, and no longer than this
const TEST_TIMEOUT_MS = 20_000

/**
 * "Deneme e-postası gönder" (adr/0036 Ek 2026-11-10): one e-mail through
 * the shop's saved mail server to the signed-in staff member's own address,
 * never to one typed in, so the button cannot mail anyone else. The
 * server's refusal comes back as a reason and its reply's numbers; nothing
 * of the message or the server's words is logged. A sent e-mail cannot be
 * taken back and nothing is stored: no compensation. Not counted in the
 * day's quota and never put on the suppression list: it is the staff
 * member's own address.
 */
const sendSmtpTestStep = createStep(
  "messaging-smtp-test-send",
  async (input: { user_id: string }, { container }) => {
    const account = await shopSmtpAccount(container)
    if (!account) {
      throw new ValidationError("messaging.smtp_missing")
    }
    const [user] = await container
      .resolve(Modules.USER)
      .listUsers({ id: input.user_id }, { select: ["email"], take: 1 })
    const to = user?.email ? normalizeRecipient("email", user.email) : null
    if (!to) {
      throw new ValidationError("messaging.smtp_test_address_missing")
    }
    const brand = await brandOf(container)
    const values = { shop: brand.shopName, from: account.fromEmail }
    const content = renderEmail(brand, {
      subject: messageText("smtp_test.subject", values),
      preheader: messageText("smtp_test.preheader"),
      heading: messageText("smtp_test.heading"),
      blocks: [
        { kind: "paragraph", text: messageText("smtp_test.intro", values) },
        { kind: "note", text: messageText("smtp_test.spam") },
      ],
      footer: messageText("footer.smtp_test", values),
    })
    const transport = createSmtpTransport(account, { tenant: tenantTag(), retry: { attempts: 1 } })
    try {
      await transport.send(
        {
          from: { email: account.fromEmail, name: account.fromName ?? brand.shopName },
          to,
          replyTo: null,
          ...content,
          template: "smtp.test",
          idempotencyKey: `smtp-test:${randomUUID()}`,
        },
        AbortSignal.timeout(TEST_TIMEOUT_MS)
      )
      return new StepResponse<SmtpTestResult>({ ok: true, to: maskRecipient("email", to) })
    } catch (error) {
      if (!isProviderError(error)) {
        throw error
      }
      logger.warn({ event: "messaging.smtp_test_failed", err: errorSummary(error) })
      return new StepResponse<SmtpTestResult>({
        ok: false,
        reason: error.providerCode as SmtpFailure | "aborted" | "invalid_address",
        reply: error.providerMessage ?? null,
      })
    }
  }
)

export const sendSmtpTestWorkflow = createWorkflow(
  "messaging-smtp-test-send",
  (input: { user_id: string }) => new WorkflowResponse(sendSmtpTestStep(input))
)
