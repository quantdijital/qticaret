import { validateAndTransformBody } from "@medusajs/framework/http"
import { RATE_LIMIT_PROFILES } from "../../lib/security/rate-limit"
import { StorePostCartOrderNote } from "../store/carts/[id]/order-note/validators"
import { rateLimit } from "./rate-limit"
import { refuseSuspendedCartWrite } from "./plan-guard"

/** Batch 8 / O1: the shopper's order note on their cart, within the checkout's budget. */
export const ORDER_NOTE_ROUTES = [
  {
    matcher: "/store/carts/:id/order-note",
    methods: ["POST" as const],
    middlewares: [
      refuseSuspendedCartWrite,
      rateLimit(() => RATE_LIMIT_PROFILES.checkout, { identity: (req) => req.params["id"] }),
      validateAndTransformBody(StorePostCartOrderNote),
    ],
  },
]
