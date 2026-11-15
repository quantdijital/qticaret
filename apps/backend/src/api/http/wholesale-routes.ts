import type {
  AuthenticatedMedusaRequest,
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { validateAndTransformBody, validateAndTransformQuery } from "@medusajs/framework/http"
import { RATE_LIMIT_PROFILES } from "../../lib/security/rate-limit"
import { GUARDED_ROUTES } from "../../lib/wholesale"
import { CUSTOMERS_WHOLESALE } from "../../modules/platform-settings/features"
import {
  AdminGetWholesaleLines,
  AdminPostWholesalePrices,
  AdminPostWholesaleTier,
  AdminUpdateWholesaleTier,
} from "../admin/wholesale/validators"
import { requireUserActor } from "./actor"
import { rateLimit } from "./rate-limit"
import { requireFeature } from "./require-feature"
import { guardWholesaleRecords, hideWholesaleRecords } from "./wholesale-guard"

type Middleware = (req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) => unknown

// A level's rate rewrites every variant's row: a small budget per staff member
const perStaff = () =>
  rateLimit(() => RATE_LIMIT_PROFILES.bulk_ship, {
    identity: (req) => (req as Partial<AuthenticatedMedusaRequest>).auth_context?.actor_id,
  })

/** Behind `customers.wholesale` (first: a shop without it sees no route), for people only. */
const staff = (...middlewares: Middleware[]): Middleware[] => [
  requireFeature(CUSTOMERS_WHOLESALE),
  requireUserActor,
  ...middlewares,
]

/**
 * ADR-0068 slice 1a: wholesale levels and their prices (owner and admin,
 * `lib/staff/permission-rules.ts`), and the guards on Medusa's own group
 * and price list routes. The guards run with the flag off too.
 */
export const WHOLESALE_ROUTES = [
  { matcher: "/admin/wholesale/tiers", methods: ["GET" as const], middlewares: staff() },
  {
    matcher: "/admin/wholesale/tiers",
    methods: ["POST" as const],
    middlewares: staff(perStaff(), validateAndTransformBody(AdminPostWholesaleTier)),
  },
  { matcher: "/admin/wholesale/tiers/:id", methods: ["GET" as const], middlewares: staff() },
  {
    matcher: "/admin/wholesale/tiers/:id",
    methods: ["POST" as const],
    middlewares: staff(perStaff(), validateAndTransformBody(AdminUpdateWholesaleTier)),
  },
  { matcher: "/admin/wholesale/tiers/:id", methods: ["DELETE" as const], middlewares: staff() },
  {
    matcher: "/admin/wholesale/tiers/:id/lines",
    methods: ["GET" as const],
    middlewares: staff(validateAndTransformQuery(AdminGetWholesaleLines, {})),
  },
  {
    matcher: "/admin/wholesale/tiers/:id/prices",
    methods: ["POST" as const],
    middlewares: staff(validateAndTransformBody(AdminPostWholesalePrices)),
  },
  // ADR-0068 §9: no write round the module to its groups and lists
  ...GUARDED_ROUTES.map(({ matcher, check }) => ({
    matcher,
    methods: ["POST" as const, "DELETE" as const],
    middlewares: [guardWholesaleRecords(check)],
  })),
  // …and Medusa's own lists of them leave the module's out
  {
    matcher: "/admin/price-lists",
    methods: ["GET" as const],
    middlewares: [hideWholesaleRecords("price_lists")],
  },
  {
    matcher: "/admin/customer-groups",
    methods: ["GET" as const],
    middlewares: [hideWholesaleRecords("customer_groups")],
  },
]
