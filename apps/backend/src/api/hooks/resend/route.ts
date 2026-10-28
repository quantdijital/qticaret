import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { parseEnv } from "../../../lib/env"
import { logger } from "../../../lib/logging"
import {
  recipientsOf,
  resendEvent,
  suppressionOf,
  verifyResendSignature,
} from "../../../lib/messaging/email/resend-webhook"
import { MESSAGING_MODULE } from "../../../modules/messaging"
import type MessagingModuleService from "../../../modules/messaging/service"
import { WEBHOOK_EVENTS_MODULE } from "../../../modules/webhook-events"
import type WebhookEventsModuleService from "../../../modules/webhook-events/service"

const header = (req: MedusaRequest, name: string): string => {
  const value = req.headers[name]
  return typeof value === "string" ? value : ""
}

/**
 * Resend's delivery reports (F9.6, adr/0036). A signed report is handled
 * once (its Svix id): a hard bounce or a spam complaint puts its addresses
 * on the suppression list, so nothing goes to them again. Anything else
 * is acknowledged and left.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const secret = parseEnv().RESEND_WEBHOOK_SECRET
  // The exact bytes Resend signed (`preserveRawBody` in MESSAGING_ROUTES)
  const raw: unknown = (req as { rawBody?: unknown }).rawBody
  const body = Buffer.isBuffer(raw) ? raw.toString("utf8") : typeof raw === "string" ? raw : ""
  const id = header(req, "svix-id")
  if (
    !secret ||
    !verifyResendSignature({
      secret,
      id,
      timestamp: header(req, "svix-timestamp"),
      signature: header(req, "svix-signature"),
      body,
    })
  ) {
    res.status(401).json({ ok: false })
    return
  }
  let parsed
  try {
    const json: unknown = JSON.parse(body)
    parsed = resendEvent.safeParse(json)
  } catch {
    parsed = null
  }
  if (!parsed?.success) {
    res.status(400).json({ ok: false })
    return
  }
  const event = parsed.data
  const events = req.scope.resolve<WebhookEventsModuleService>(WEBHOOK_EVENTS_MODULE)
  const claim = await events.claim("resend", id, { type: event.type })
  if (claim.state === "done" || claim.state === "busy") {
    res.json({ ok: true })
    return
  }
  const suppression = suppressionOf(event)
  try {
    if (suppression) {
      const messaging = req.scope.resolve<MessagingModuleService>(MESSAGING_MODULE)
      for (const to of recipientsOf(event)) {
        if (messaging.recipientOf("email", to)) {
          await messaging.suppress({
            channel: "email",
            address: to,
            source: "resend",
            ...suppression,
          })
        }
      }
    }
    await events.markProcessed(claim.id, { type: event.type, suppressed: suppression !== null })
  } catch (error) {
    await events.markFailed(claim.id, "processing_failed")
    logger.warn({ event: "resend.report_failed", type: event.type })
    throw error
  }
  res.json({ ok: true })
}
