import { validateAndTransformBody, validateAndTransformQuery } from "@medusajs/framework/http"
import { RATE_LIMIT_PROFILES } from "../../lib/security/rate-limit"
import { CATALOG_BOOKING } from "../../modules/platform-settings/features"
import {
  AdminGetContactMessages,
  AdminPostContactMessage,
} from "../admin/contact-messages/validators"
import { StorePostBookingRequest } from "../store/booking-requests/validators"
import { StorePostContactMessage } from "../store/contact-messages/validators"
import { StorePostNewsletter } from "../store/newsletter/validators"
import { challengeOver } from "./challenge"
import { requireMailDomain } from "./mail-domain"
import { optionalCustomer } from "./order-access"
import { rateLimit } from "./rate-limit"
import { requireFeature } from "./require-feature"

const HOUR = 60 * 60 * 1000

const byEmail = (req: { body?: unknown }) => {
  const email = (req.body as { email?: unknown } | undefined)?.email
  return typeof email === "string" ? email.trim().toLowerCase() : undefined
}

// A booking request's phone, its national ten digits however typed
const byPhone = (req: { body?: unknown }) => {
  const phone = (req.body as { phone?: unknown } | undefined)?.phone
  const digits = typeof phone === "string" ? phone.replace(/\D/g, "").slice(-10) : ""
  return digits === "" ? undefined : `phone:${digits}`
}

/**
 * The storefront's contact form and its panel list (F18 D10, adr/0047),
 * and its newsletter box (double opt-in, adr/0038 §2).
 * A message is counted per address and per sender, a proof of work after
 * the first in an hour, and the sender's domain must take mail: the shop
 * answers by e-mail.
 */
export const CONTACT_ROUTES = [
  {
    matcher: "/store/contact-messages",
    methods: ["POST" as const],
    middlewares: [
      optionalCustomer,
      rateLimit(() => RATE_LIMIT_PROFILES.contact_message, { identity: byEmail }),
      challengeOver("contact", { max: 1, windowMs: HOUR }),
      validateAndTransformBody(StorePostContactMessage),
      requireMailDomain(),
    ],
  },
  {
    // adr/0076 Ek 2026-11-23: a dated product's call-me request, kept as a
    // contact message; the contact form's limits, its proof of work shared
    matcher: "/store/booking-requests",
    methods: ["POST" as const],
    middlewares: [
      requireFeature(CATALOG_BOOKING),
      optionalCustomer,
      // Per address and per e-mail as the contact form; the phone always counted too (D1)
      rateLimit(() => RATE_LIMIT_PROFILES.contact_message, { identity: byEmail }),
      rateLimit(() => RATE_LIMIT_PROFILES.booking_request_phone, { identity: byPhone }),
      challengeOver("contact", { max: 1, windowMs: HOUR }),
      validateAndTransformBody(StorePostBookingRequest),
      requireMailDomain(),
    ],
  },
  {
    matcher: "/store/newsletter",
    methods: ["POST" as const],
    middlewares: [
      optionalCustomer,
      rateLimit(() => RATE_LIMIT_PROFILES.newsletter, { identity: byEmail }),
      challengeOver("newsletter", { max: 3, windowMs: HOUR }),
      validateAndTransformBody(StorePostNewsletter),
      requireMailDomain(),
    ],
  },
  {
    matcher: "/admin/contact-messages",
    methods: ["GET" as const],
    middlewares: [validateAndTransformQuery(AdminGetContactMessages, {})],
  },
  {
    matcher: "/admin/contact-messages/:id",
    methods: ["POST" as const],
    middlewares: [validateAndTransformBody(AdminPostContactMessage)],
  },
]
