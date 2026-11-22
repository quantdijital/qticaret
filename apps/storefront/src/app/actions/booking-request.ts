"use server"

import { z } from "zod"
import type { PlaceOrderResult } from "@qticaret/ui"
import { challengeOf } from "@/lib/checkout/pay"
import { isStoreApiError } from "@/lib/store-api/errors"
import { storeCall } from "@/lib/store-api/server"

const optional = <Schema extends z.ZodType<string, string>>(schema: Schema) =>
  schema.optional().or(z.literal("").transform(() => undefined))

const count = (min: number) => z.coerce.number().int().min(min).max(500)

// The backend checks it all again; this keeps a malformed form from costing a call
const Request = z.object({
  product_id: z.string().regex(/^prod_[0-9A-Za-z]{10,64}$/),
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(7).max(20),
  email: optional(z.string().trim().toLowerCase().max(254).pipe(z.email())),
  // `when`: a departure's id, "date", "month" or "flexible"; the field it names comes with it
  when: z.string().max(80),
  date: optional(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  month: optional(z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/)),
  adults: count(1),
  children: z
    .union([count(0), z.literal("").transform(() => 0)])
    .optional()
    .transform((value) => value ?? 0),
  note: optional(z.string().trim().max(1000)),
  consent: z.literal("1"),
  challenge: optional(z.string().regex(/^[\w.-]{1,300}$/)),
})

const SLOT_ID = /^bkslot_[0-9A-Za-z]{10,64}$/

/** The backend's refusals as the form's own keys. */
function failure(error: unknown): string {
  if (!isStoreApiError(error)) {
    return "booking_request.failed"
  }
  if (error.status === 429) {
    return "booking_request.rate_limited"
  }
  if (error.messageKey === "messaging.email_domain_refuses") {
    return "booking_request.email_domain"
  }
  if (error.status === 400) {
    const key = error.messageKey ?? ""
    if (key.includes("phone")) {
      return "booking_request.phone_invalid"
    }
    if (key === "booking.request_slot_invalid" || key === "booking.request_when_invalid") {
      return "booking_request.when_invalid"
    }
    if (key === "booking.request_people_invalid") {
      return "booking_request.people_invalid"
    }
    return "booking_request.invalid"
  }
  return "booking_request.failed"
}

/** The one of departure, day or month the shopper chose; nothing for open dates. */
function whenOf(
  data: z.infer<typeof Request>
): { ok: true; when: Record<string, string> } | { ok: false; error: string } {
  if (data.when === "flexible") {
    return { ok: true, when: {} }
  }
  if (data.when === "date") {
    return data.date
      ? { ok: true, when: { date: data.date } }
      : { ok: false, error: "booking_request.when_invalid" }
  }
  if (data.when === "month") {
    return data.month
      ? { ok: true, when: { month: data.month } }
      : { ok: false, error: "booking_request.when_invalid" }
  }
  return SLOT_ID.test(data.when)
    ? { ok: true, when: { slot_id: data.when } }
    : { ok: false, error: "booking_request.when_invalid" }
}

/**
 * A dated product's "call me" request (adr/0076 Ek 2026-11-23): no payment,
 * no places held; kept by the backend for the shop to call back.
 */
export async function requestBooking(
  _state: PlaceOrderResult,
  form: FormData
): Promise<PlaceOrderResult> {
  const parsed = Request.safeParse(Object.fromEntries(form))
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0]
    const error =
      field === "phone"
        ? "booking_request.phone_invalid"
        : field === "consent"
          ? "booking_request.consent_required"
          : field === "email"
            ? "booking_request.email_invalid"
            : "booking_request.invalid"
    return { ok: false, error, challenge: null }
  }
  const when = whenOf(parsed.data)
  if (!when.ok) {
    return { ok: false, error: when.error, challenge: null }
  }
  const { challenge, product_id, name, phone, email, adults, children, note } = parsed.data
  try {
    await storeCall("/store/booking-requests", {
      method: "POST",
      body: {
        product_id,
        name,
        phone,
        ...(email ? { email } : {}),
        ...when.when,
        adults,
        ...(children > 0 ? { children } : {}),
        ...(note ? { note } : {}),
        consent: true,
      },
      ...(challenge ? { headers: { "x-challenge": challenge } } : {}),
    })
  } catch (error) {
    const asked = challengeOf(error)
    if (asked) {
      return { ok: false, error: null, challenge: asked }
    }
    return { ok: false, error: failure(error), challenge: null }
  }
  return { ok: true, error: null, challenge: null }
}
