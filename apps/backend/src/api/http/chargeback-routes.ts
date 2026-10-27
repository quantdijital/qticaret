import { validateAndTransformBody, validateAndTransformQuery } from "@medusajs/framework/http"
import {
  AdminGetChargebacks,
  AdminPostChargeback,
  AdminPostChargebackMove,
} from "../admin/chargebacks/validators"
import { requireUserActor } from "./actor"

/** F6.7 (adr/0030): disputes, staff only; integration keys cannot record or read them. */
export const CHARGEBACK_ROUTES = [
  {
    matcher: "/admin/chargebacks",
    methods: ["GET" as const],
    middlewares: [requireUserActor, validateAndTransformQuery(AdminGetChargebacks, {})],
  },
  {
    matcher: "/admin/chargebacks",
    methods: ["POST" as const],
    middlewares: [requireUserActor, validateAndTransformBody(AdminPostChargeback)],
  },
  {
    matcher: "/admin/chargebacks/:id",
    methods: ["POST" as const],
    middlewares: [requireUserActor, validateAndTransformBody(AdminPostChargebackMove)],
  },
  {
    matcher: "/admin/chargebacks/:id/evidence",
    methods: ["GET" as const],
    middlewares: [requireUserActor],
  },
]
