import { validateAndTransformBody, validateAndTransformQuery } from "@medusajs/framework/http"
import { RATE_LIMIT_PROFILES } from "../../lib/security/rate-limit"
import {
  AdminGetContactMessages,
  AdminPostContactMessage,
} from "../admin/contact-messages/validators"
import { StorePostContactMessage } from "../store/contact-messages/validators"
import { challengeOver } from "./challenge"
import { requireMailDomain } from "./mail-domain"
import { optionalCustomer } from "./order-access"
import { rateLimit } from "./rate-limit"

const HOUR = 60 * 60 * 1000

/**
 * The storefront's contact form and its panel list (F18 D10, adr/0047).
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
      rateLimit(() => RATE_LIMIT_PROFILES.contact_message, {
        identity: (req) => {
          const email = (req.body as { email?: unknown } | undefined)?.email
          return typeof email === "string" ? email.trim().toLowerCase() : undefined
        },
      }),
      challengeOver("contact", { max: 1, windowMs: HOUR }),
      validateAndTransformBody(StorePostContactMessage),
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
