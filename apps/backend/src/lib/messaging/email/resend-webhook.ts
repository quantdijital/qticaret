import { createHmac } from "node:crypto"
import { z } from "@medusajs/framework/zod"
import { safeEqual } from "@qticaret/server-kit"

/**
 * Resend's delivery reports (adr/0036), signed the Svix way: HMAC-SHA256
 * over `id.timestamp.body` with the base64 key after `whsec_`, one or more
 * `v1,<base64>` signatures, a timestamp within five minutes. Only the
 * fields that decide a suppression are read.
 */

export const RESEND_TOLERANCE_SECONDS = 5 * 60

export function verifyResendSignature(input: {
  secret: string
  id: string
  timestamp: string
  signature: string
  body: string
  now?: Date
}): boolean {
  const seconds = Number(input.timestamp)
  const now = Math.floor((input.now ?? new Date()).getTime() / 1000)
  if (!Number.isInteger(seconds) || Math.abs(now - seconds) > RESEND_TOLERANCE_SECONDS) {
    return false
  }
  if (!/^[\w-]{1,128}$/.test(input.id) || !input.secret.startsWith("whsec_")) {
    return false
  }
  const key = Buffer.from(input.secret.slice("whsec_".length), "base64")
  const expected = createHmac("sha256", key)
    .update(`${input.id}.${input.timestamp}.${input.body}`, "utf8")
    .digest("base64")
  return input.signature
    .split(" ")
    .map((each) => each.split(","))
    .some(
      ([version, value]) => version === "v1" && value !== undefined && safeEqual(value, expected)
    )
}

const address = z.string().max(320)

/** What a report says, as far as a suppression goes. */
export const resendEvent = z
  .object({
    type: z.string().max(64),
    data: z
      .object({
        to: z.union([address, z.array(address).max(50)]).optional(),
        bounce: z
          .object({ type: z.string().max(40).optional(), subType: z.string().max(40).optional() })
          .loose()
          .optional(),
        // The send's tags, as a map (Resend's report format)
        tags: z.record(z.string().max(256), z.string().max(256)).optional(),
      })
      .loose(),
  })
  .loose()

export type ResendEvent = z.infer<typeof resendEvent>

/**
 * Whether the report is about this shop's own send: Resend reports every
 * send of the account to each webhook, and another shop's bounce is not
 * this shop's to act on (nor its customers' addresses to list).
 */
export const isOwnReport = (event: ResendEvent, tenant: string): boolean =>
  event.data.tags?.["tenant"] === tenant

/** Whether the report puts its addresses on the list, and why: a hard bounce or a complaint. */
export function suppressionOf(
  event: ResendEvent
): { reason: "bounce" | "complaint"; detail: string | null } | null {
  if (event.type === "email.complained") {
    return { reason: "complaint", detail: null }
  }
  // A transient bounce (a full mailbox) may pass next time; only a permanent one is final
  if (event.type === "email.bounced" && event.data.bounce?.type === "Permanent") {
    return { reason: "bounce", detail: event.data.bounce.subType ?? event.data.bounce.type }
  }
  return null
}

export const recipientsOf = (event: ResendEvent): string[] => {
  const to = event.data.to
  return to === undefined ? [] : Array.isArray(to) ? to : [to]
}
