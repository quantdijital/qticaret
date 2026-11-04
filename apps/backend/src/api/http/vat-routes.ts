import { validateAndTransformBody, validateAndTransformQuery } from "@medusajs/framework/http"
import { AdminGetDashboardNoQuery } from "../admin/dashboard/validators"
import {
  AdminPostVatDefault,
  AdminPostVatRate,
  AdminUpdateVatRate,
} from "../admin/vat-rates/validators"
import { requireUserActor } from "./actor"

/**
 * The shop's KDV rates (adr/0007 Ek 2026-11-04): every role reads them;
 * the owner alone writes them (the role table), people only.
 */
export const VAT_ROUTES = [
  {
    matcher: "/admin/vat-rates",
    methods: ["GET" as const],
    middlewares: [requireUserActor, validateAndTransformQuery(AdminGetDashboardNoQuery, {})],
  },
  {
    matcher: "/admin/vat-rates",
    methods: ["POST" as const],
    middlewares: [requireUserActor, validateAndTransformBody(AdminPostVatRate)],
  },
  // Medusa gives the static route its own middlewares, not those of `:id`
  {
    matcher: "/admin/vat-rates/default",
    methods: ["POST" as const],
    middlewares: [requireUserActor, validateAndTransformBody(AdminPostVatDefault)],
  },
  {
    matcher: "/admin/vat-rates/:id",
    methods: ["POST" as const],
    middlewares: [requireUserActor, validateAndTransformBody(AdminUpdateVatRate)],
  },
]
