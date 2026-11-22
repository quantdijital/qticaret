import { validateAndTransformBody, validateAndTransformQuery } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { RATE_LIMIT_PROFILES } from "../../lib/security/rate-limit"
import { CATALOG_BOOKING } from "../../modules/platform-settings/features"
import {
  AdminGetOrderBookings,
  AdminPostOrderBookingCancel,
} from "../admin/orders/[id]/bookings/validators"
import { StorePostBookingCancel } from "../store/orders/[id]/bookings/validators"
import { requireUserActor } from "./actor"
import { refuseCaptureForCancelledDeparture } from "./booking-capture-guard"
import { optionalCustomer, orderAccess, orderActor } from "./order-access"
import { refundLimit } from "./order-refund-routes"
import { rateLimit } from "./rate-limit"
import { requireFeature } from "./require-feature"

const NoBody = z.object({}).strict()

/**
 * Dated orders' cancels (adr/0076 §8, Ek D7a), behind `catalog.booking`.
 * The shopper's: their own order only (signed in or with the order's key,
 * adr/0037 §2; anyone else is told there is no such order), within the
 * order cancel's budget. Staff's: reads every role's; a cancel gives money
 * back, so it is the owner's and admin's (the role table's default for a
 * POST, as an order's cancel and refunds), a staff member's only (no
 * integration key) and within the refunds' budget (review D6).
 */
export const BOOKING_CANCEL_ROUTES = [
  {
    matcher: "/store/orders/:id/bookings",
    methods: ["GET" as const],
    middlewares: [requireFeature(CATALOG_BOOKING), optionalCustomer, orderAccess],
  },
  {
    matcher: "/store/orders/:id/bookings/cancel",
    methods: ["POST" as const],
    middlewares: [
      requireFeature(CATALOG_BOOKING),
      optionalCustomer,
      orderAccess,
      rateLimit(() => RATE_LIMIT_PROFILES.order_cancel, { identity: orderActor }),
      validateAndTransformBody(StorePostBookingCancel),
    ],
  },
  {
    matcher: "/admin/orders/:id/bookings",
    methods: ["GET" as const],
    middlewares: [
      requireFeature(CATALOG_BOOKING),
      validateAndTransformQuery(AdminGetOrderBookings, {}),
    ],
  },
  {
    matcher: "/admin/orders/:id/bookings/cancel",
    methods: ["POST" as const],
    middlewares: [
      requireFeature(CATALOG_BOOKING),
      requireUserActor,
      refundLimit,
      validateAndTransformBody(AdminPostOrderBookingCancel),
    ],
  },
  {
    matcher: "/admin/booking-slots/:id/cancel",
    methods: ["GET" as const],
    middlewares: [requireFeature(CATALOG_BOOKING)],
  },
  {
    matcher: "/admin/booking-slots/:id/cancel",
    methods: ["POST" as const],
    middlewares: [
      requireFeature(CATALOG_BOOKING),
      requireUserActor,
      refundLimit,
      validateAndTransformBody(NoBody),
    ],
  },
  // No `methods` on purpose (a method-scoped middleware may sort after the core route);
  // whatever the flag, a cancelled departure's order takes no money (review O3)
  { matcher: "/admin/payments/:id/capture", middlewares: [refuseCaptureForCancelledDeparture] },
]
