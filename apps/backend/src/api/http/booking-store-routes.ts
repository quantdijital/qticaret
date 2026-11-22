import { validateAndTransformBody, validateAndTransformQuery } from "@medusajs/framework/http"
import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { hashPii, parseKey } from "@qticaret/server-kit"
import { bookingMarkOf } from "../../lib/booking/cart-lines"
import { parseEnv } from "../../lib/env"
import { ValidationError } from "../../lib/errors"
import { RATE_LIMIT_PROFILES, ipBucket } from "../../lib/security/rate-limit"
import { CATALOG_BOOKING } from "../../modules/platform-settings/features"
import { StorePostCartBooking } from "../store/carts/[id]/bookings/validators"
import { StoreGetProductBooking } from "../store/products/[id]/booking/validators"
import { clientIp, isShopperAddressUnknown } from "./client-ip"
import { rateLimit } from "./rate-limit"
import { requireFeature } from "./require-feature"

/**
 * A dated line changes only through its booking route (adr/0076 §5): the
 * core line route may not change its quantity (its places would not
 * follow) nor its metadata. Removing it (DELETE) stays open; its places
 * go back as the cart changes (`subscribers/booking-cart-sync.ts`).
 */
export async function protectBookingLine(
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction
): Promise<void> {
  if (req.method !== "POST") {
    next()
    return
  }
  try {
    const { data } = await req.scope.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "cart",
      fields: ["items.id", "items.metadata"],
      filters: { id: req.params["id"] ?? "" },
    })
    const line = (
      (data[0] as { items?: ({ id: string; metadata?: unknown } | null)[] } | undefined)?.items ??
      []
    ).find((item) => item?.id === req.params["line_id"])
    next(
      bookingMarkOf(line?.metadata)
        ? new ValidationError("booking.use_booking_route", { field: "quantity" })
        : undefined
    )
  } catch (error) {
    next(error)
  }
}

let clientHashKey: Buffer | undefined

/**
 * The shopper's address as a booking hold keeps it (adr/0076 Ek takip M1):
 * a keyed hash of the address the limits count (IPv6 by its /64), never
 * the address nor a plain hash a list of addresses would reverse. Null
 * when no address is known: such a hold is not capped by address. A call
 * our storefront's server signed as "address unknown" (adr/0076 Ek D5) is
 * one of them: its connection address is the storefront's, which every
 * such shopper would share.
 */
export function bookingClientHash(req: MedusaRequest): string | null {
  if (isShopperAddressUnknown(req)) {
    return null
  }
  const bucket = ipBucket(clientIp(req) ?? undefined)
  if (bucket === null) {
    return null
  }
  clientHashKey ??= parseKey(parseEnv().PII_HASH_KEY, "PII_HASH_KEY")
  return hashPii(bucket, clientHashKey, "booking.client").slice(0, 32)
}

// Holding places has its own budget, per address and per cart (adr/0076 Ek):
// a shopper choosing dates does not use up the payment's
const bookingLimit = rateLimit(() => RATE_LIMIT_PROFILES.booking, {
  identity: (req) => req.params["id"],
})

/**
 * The storefront's side of dated products (adr/0076 §5, §10), each route
 * behind the shop's `catalog.booking` flag, which answers first (off: as
 * if it did not exist). The line guard reads a line only when it is posted.
 */
export const BOOKING_STORE_ROUTES = [
  {
    matcher: "/store/products/:id/booking",
    methods: ["GET" as const],
    middlewares: [
      requireFeature(CATALOG_BOOKING),
      validateAndTransformQuery(StoreGetProductBooking, {}),
    ],
  },
  {
    matcher: "/store/carts/:id/bookings",
    methods: ["POST" as const],
    middlewares: [
      requireFeature(CATALOG_BOOKING),
      bookingLimit,
      validateAndTransformBody(StorePostCartBooking),
    ],
  },
  {
    // The cart's hold and dated lines, for the storefront's countdown (adr/0076 Ek D5); reads only
    matcher: "/store/carts/:id/bookings",
    methods: ["GET" as const],
    middlewares: [requireFeature(CATALOG_BOOKING)],
  },
  {
    matcher: "/store/carts/:id/bookings/:slot_id",
    methods: ["DELETE" as const],
    middlewares: [requireFeature(CATALOG_BOOKING), bookingLimit],
  },
  {
    matcher: "/store/carts/:id/line-items/:line_id",
    middlewares: [protectBookingLine],
  },
]
