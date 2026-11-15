import type {
  AuthenticatedMedusaRequest,
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { validateAndTransformBody, validateAndTransformQuery } from "@medusajs/framework/http"
import { RATE_LIMIT_PROFILES } from "../../lib/security/rate-limit"
import { GUARDED_ROUTES, READ_GUARDED } from "../../lib/wholesale"
import { CUSTOMERS_WHOLESALE } from "../../modules/platform-settings/features"
import {
  AdminGetWholesaleLines,
  AdminGetWholesaleTiers,
  AdminPostWholesalePrices,
  AdminPostWholesaleTier,
  AdminUpdateWholesaleTier,
} from "../admin/wholesale/validators"
import {
  AdminGetWholesaleAccounts,
  AdminPostWholesaleAccount,
  AdminPostWholesaleAccountAction,
  AdminUpdateWholesaleAccount,
} from "../admin/wholesale/account-validators"
import { requireUserActor } from "./actor"
import { rateLimit } from "./rate-limit"
import { requireFeature } from "./require-feature"
import { guardWholesaleRecords, hideWholesaleRecords } from "./wholesale-guard"
import { guardWholesaleMembers, hideWholesalePriceRows } from "./wholesale-reads"

type Middleware = (req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) => unknown

// A level's rate rewrites every variant's row: a small budget per staff member
const perStaff = () =>
  rateLimit(() => RATE_LIMIT_PROFILES.bulk_ship, {
    identity: (req) => (req as Partial<AuthenticatedMedusaRequest>).auth_context?.actor_id,
  })

// A wholesaler opened or invited again mails an address in the shop's name
const perStaffInvite = () =>
  rateLimit(() => RATE_LIMIT_PROFILES.wholesale_invite, {
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
 * and price list routes. The guards run with the flag off too. Slice 1b:
 * wholesalers; the claim on sign-in is `http/wholesale-claim.ts`.
 */
export const WHOLESALE_ROUTES = [
  {
    matcher: "/admin/wholesale/tiers",
    methods: ["GET" as const],
    middlewares: staff(validateAndTransformQuery(AdminGetWholesaleTiers, {})),
  },
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
  // Slice 1b: wholesalers (ADR-0068 §3), their own prices as a level's
  {
    matcher: "/admin/wholesale/accounts",
    methods: ["GET" as const],
    middlewares: staff(validateAndTransformQuery(AdminGetWholesaleAccounts, {})),
  },
  {
    matcher: "/admin/wholesale/accounts",
    methods: ["POST" as const],
    middlewares: staff(perStaffInvite(), validateAndTransformBody(AdminPostWholesaleAccount)),
  },
  { matcher: "/admin/wholesale/accounts/:id", methods: ["GET" as const], middlewares: staff() },
  {
    matcher: "/admin/wholesale/accounts/:id",
    methods: ["POST" as const],
    middlewares: staff(perStaff(), validateAndTransformBody(AdminUpdateWholesaleAccount)),
  },
  { matcher: "/admin/wholesale/accounts/:id", methods: ["DELETE" as const], middlewares: staff() },
  ...["deactivate", "reactivate"].map((action) => ({
    matcher: `/admin/wholesale/accounts/:id/${action}`,
    methods: ["POST" as const],
    middlewares: staff(validateAndTransformBody(AdminPostWholesaleAccountAction)),
  })),
  {
    matcher: "/admin/wholesale/accounts/:id/invitation",
    methods: ["POST" as const],
    middlewares: staff(perStaffInvite(), validateAndTransformBody(AdminPostWholesaleAccountAction)),
  },
  {
    matcher: "/admin/wholesale/accounts/:id/lines",
    methods: ["GET" as const],
    middlewares: staff(validateAndTransformQuery(AdminGetWholesaleLines, {})),
  },
  {
    matcher: "/admin/wholesale/accounts/:id/prices",
    methods: ["POST" as const],
    middlewares: staff(validateAndTransformBody(AdminPostWholesalePrices)),
  },
  // ADR-0068 §9: no write round the module to its groups and lists, and no read of them by id
  ...GUARDED_ROUTES.map(({ matcher, check }) => ({
    matcher,
    methods: READ_GUARDED.has(check)
      ? ["GET" as const, "POST" as const, "DELETE" as const]
      : ["POST" as const, "DELETE" as const],
    middlewares: [guardWholesaleRecords(check)],
  })),
  // Decision 17: wholesale price rows and members stay out of Medusa's product and customer reads
  ...["/admin/products", "/admin/products/*", "/admin/product-variants"].map((matcher) => ({
    matcher,
    middlewares: [hideWholesalePriceRows],
  })),
  ...["/admin/customers", "/admin/customers/*"].map((matcher) => ({
    matcher,
    methods: ["GET" as const],
    middlewares: [guardWholesaleMembers],
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
