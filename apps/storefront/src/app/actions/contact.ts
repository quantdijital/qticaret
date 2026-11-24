"use server"

import { z } from "zod"
import type { PlaceOrderResult } from "@qticaret/ui"
import { gateAsk, gated } from "@/lib/store-api/gate"
import { isStoreApiError } from "@/lib/store-api/errors"
import { storeCall } from "@/lib/store-api/server"

// `kvkk`: a guest's data request (adr/0047 Ek 2026-11-02); a customer asks from the account too
const SUBJECTS = ["order", "product", "return", "payment", "kvkk", "other"] as const

const optional = (schema: z.ZodString) =>
  schema.optional().or(z.literal("").transform(() => undefined))

// The backend checks it all again; this keeps a malformed form from costing a call
const Message = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  phone: optional(z.string().trim().max(20)),
  subject: z.enum(SUBJECTS),
  order_number: optional(
    z
      .string()
      .trim()
      .regex(/^#?\d{1,12}$/)
  ),
  body: z.string().trim().min(10).max(3000),
  challenge: optional(z.string().regex(/^[\w.-]{1,300}$/)),
})

function failure(error: unknown): string {
  if (!isStoreApiError(error)) {
    return "contact.failed"
  }
  if (error.status === 429) {
    return "contact.rate_limited"
  }
  if (error.messageKey === "messaging.email_domain_refuses") {
    return "contact.email_domain"
  }
  if (error.status === 400) {
    return error.messageKey?.includes("phone") ? "contact.phone_invalid" : "contact.invalid"
  }
  return "contact.failed"
}

/** The contact form (adr/0047): kept by the backend, answered by the shop by e-mail. */
export async function sendContact(
  _state: PlaceOrderResult,
  form: FormData
): Promise<PlaceOrderResult> {
  const parsed = Message.safeParse(Object.fromEntries(form))
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0]
    return {
      ok: false,
      error: field === "phone" ? "contact.phone_invalid" : "contact.invalid",
      challenge: null,
    }
  }
  const { challenge: _answered, ...message } = parsed.data
  try {
    await storeCall("/store/contact-messages", {
      method: "POST",
      body: message,
      ...gated(form),
    })
  } catch (error) {
    const asked = gateAsk(error)
    if (asked) {
      return asked
    }
    return { ok: false, error: failure(error), challenge: null }
  }
  return { ok: true, error: null, challenge: null }
}
