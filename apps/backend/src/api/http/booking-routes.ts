import { validateAndTransformBody, validateAndTransformQuery } from "@medusajs/framework/http"
import { CATALOG_BOOKING } from "../../modules/platform-settings/features"
import {
  AdminGetBookingSlots,
  AdminPostBookable,
  AdminPostBookingSlot,
  AdminPostBookingSlots,
} from "../admin/booking-slots/validators"
import { AdminPostRevealTaxId } from "../admin/customers/[id]/billing-profile/reveal/validators"
import { requireReauth } from "./reauth"
import { requireFeature } from "./require-feature"

/**
 * Dated products' settings and departures (adr/0076 §3), behind
 * `catalog.booking`: off, every route answers as if it did not exist.
 * Writes are the product editors' (owner and admin, the staff rules'
 * default); reads every role's.
 */
export const BOOKING_ROUTES = [
  {
    matcher: "/admin/products/:id/bookable",
    methods: ["GET" as const],
    middlewares: [requireFeature(CATALOG_BOOKING)],
  },
  {
    matcher: "/admin/products/:id/bookable",
    methods: ["POST" as const],
    middlewares: [requireFeature(CATALOG_BOOKING), validateAndTransformBody(AdminPostBookable)],
  },
  {
    matcher: "/admin/products/:id/booking-slots",
    methods: ["GET" as const],
    middlewares: [
      requireFeature(CATALOG_BOOKING),
      validateAndTransformQuery(AdminGetBookingSlots, {}),
    ],
  },
  {
    matcher: "/admin/products/:id/booking-slots",
    methods: ["POST" as const],
    middlewares: [requireFeature(CATALOG_BOOKING), validateAndTransformBody(AdminPostBookingSlots)],
  },
  {
    matcher: "/admin/booking-slots/:id",
    methods: ["POST" as const],
    middlewares: [requireFeature(CATALOG_BOOKING), validateAndTransformBody(AdminPostBookingSlot)],
  },
  {
    // Every role that reads orders: each one does (adr/0040); no person's details in it
    matcher: "/admin/booking-slots/:id/bookings",
    methods: ["GET" as const],
    middlewares: [requireFeature(CATALOG_BOOKING)],
  },
  {
    // A traveler's full ID number (adr/0076 §7): owner and admin by the role table (a
    // POST), proved again, recorded by the route before it answers
    matcher: "/admin/booking-travelers/:id/reveal",
    methods: ["POST" as const],
    middlewares: [
      requireFeature(CATALOG_BOOKING),
      requireReauth(),
      validateAndTransformBody(AdminPostRevealTaxId),
    ],
  },
]
