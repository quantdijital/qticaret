import { validateAndTransformBody, validateAndTransformQuery } from "@medusajs/framework/http"
import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http"
import { RATE_LIMIT_PROFILES } from "../../lib/security/rate-limit"
import { AdminPostTemplateTexts } from "../admin/messaging/customer-messages/validators"
import { AdminPostSenderDomain } from "../admin/messaging/sender-domain/validators"
import { AdminPostSmtpTest } from "../admin/messaging/smtp/test/validators"
import {
  AdminGetSuppressions,
  AdminPostSuppression,
} from "../admin/messaging/suppressions/validators"
import { requireUserActor } from "./actor"
import { rateLimit } from "./rate-limit"

const perStaff = () =>
  rateLimit(() => RATE_LIMIT_PROFILES.provider_check, {
    identity: (req) => (req as Partial<AuthenticatedMedusaRequest>).auth_context?.actor_id,
  })

/** F9 (adr/0036): Resend's signed delivery reports and the suppression list. */
export const MESSAGING_ROUTES = [
  // The signature covers the exact bytes Resend sent
  {
    matcher: "/hooks/resend",
    methods: ["POST" as const],
    bodyParser: { preserveRawBody: true },
    middlewares: [rateLimit(() => RATE_LIMIT_PROFILES.webhook)],
  },
  // F10 M11: how the consents are reaching İYS
  { matcher: "/admin/messaging/iys", methods: ["GET" as const], middlewares: [requireUserActor] },
  {
    matcher: "/admin/messaging/suppressions",
    methods: ["GET" as const],
    middlewares: [requireUserActor, validateAndTransformQuery(AdminGetSuppressions, {})],
  },
  {
    matcher: "/admin/messaging/suppressions",
    methods: ["POST" as const],
    middlewares: [requireUserActor, validateAndTransformBody(AdminPostSuppression)],
  },
  {
    matcher: "/admin/messaging/suppressions/:id",
    methods: ["DELETE" as const],
    middlewares: [requireUserActor],
  },
  {
    matcher: "/admin/messaging/templates*",
    methods: ["GET" as const],
    middlewares: [requireUserActor],
  },
  // adr/0036 Ek 2026-11-10: the shop's words for its customer messages, and a draft's preview
  {
    matcher: "/admin/messaging/templates/:name/preview",
    methods: ["POST" as const],
    middlewares: [requireUserActor, validateAndTransformBody(AdminPostTemplateTexts)],
  },
  {
    matcher: "/admin/messaging/customer-messages",
    methods: ["GET" as const],
    middlewares: [requireUserActor],
  },
  {
    matcher: "/admin/messaging/customer-messages/:name",
    methods: ["POST" as const],
    middlewares: [requireUserActor, validateAndTransformBody(AdminPostTemplateTexts)],
  },
  {
    matcher: "/admin/messaging/sender-domain",
    methods: ["GET" as const, "DELETE" as const],
    middlewares: [requireUserActor],
  },
  // Each asks Resend: a small budget per staff member
  {
    matcher: "/admin/messaging/sender-domain",
    methods: ["POST" as const],
    middlewares: [requireUserActor, perStaff(), validateAndTransformBody(AdminPostSenderDomain)],
  },
  {
    matcher: "/admin/messaging/sender-domain/check",
    methods: ["POST" as const],
    middlewares: [requireUserActor, perStaff()],
  },
  // adr/0036 Ek 2026-11-10: an e-mail through the shop's own mail server, to the caller
  {
    matcher: "/admin/messaging/smtp/test",
    methods: ["POST" as const],
    middlewares: [requireUserActor, perStaff(), validateAndTransformBody(AdminPostSmtpTest)],
  },
]
