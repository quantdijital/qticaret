import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { validateAndTransformBody, validateAndTransformQuery } from "@medusajs/framework/http"
import { RATE_LIMIT_PROFILES } from "../../lib/security/rate-limit"
import { MARKETING_POPUPS } from "../../modules/platform-settings/features"
import {
  AdminGetPopups,
  AdminPostPopup,
  AdminPostPopupStatus,
  AdminUpdatePopup,
} from "../admin/popups/validators"
import { StorePostPopupEvent } from "../store/popups/[id]/events/validators"
import { requireUserActor } from "./actor"
import { rateLimit } from "./rate-limit"
import { requireFeature } from "./require-feature"

type Middleware = (req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) => unknown

/**
 * adr/0080: storefront pop-ups behind `marketing.popups` (first, so a
 * shop without it sees no route at all). The panel's routes are for
 * people only; writes are the owner's and admin's (adr/0040: `operations`
 * is refused by default, as for promotions). The storefront reads the
 * live ones and sends their counters, within a budget per address.
 */
const gated = (...middlewares: Middleware[]): Middleware[] => [
  requireFeature(MARKETING_POPUPS),
  ...middlewares,
]

const staff = (...middlewares: Middleware[]): Middleware[] =>
  gated(requireUserActor, ...middlewares)

export const POPUP_ROUTES = [
  {
    matcher: "/admin/popups",
    methods: ["GET" as const],
    middlewares: staff(validateAndTransformQuery(AdminGetPopups, {})),
  },
  {
    matcher: "/admin/popups",
    methods: ["POST" as const],
    middlewares: staff(validateAndTransformBody(AdminPostPopup)),
  },
  { matcher: "/admin/popups/:id", methods: ["GET" as const], middlewares: staff() },
  {
    matcher: "/admin/popups/:id",
    methods: ["POST" as const],
    middlewares: staff(validateAndTransformBody(AdminUpdatePopup)),
  },
  { matcher: "/admin/popups/:id", methods: ["DELETE" as const], middlewares: staff() },
  {
    matcher: "/admin/popups/:id/status",
    methods: ["POST" as const],
    middlewares: staff(validateAndTransformBody(AdminPostPopupStatus)),
  },
  { matcher: "/store/popups", methods: ["GET" as const], middlewares: gated() },
  {
    matcher: "/store/popups/:id/events",
    methods: ["POST" as const],
    middlewares: gated(
      rateLimit(() => RATE_LIMIT_PROFILES.popup_event),
      validateAndTransformBody(StorePostPopupEvent)
    ),
  },
]
