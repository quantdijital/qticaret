import { requireUserActor } from "./actor"

/** F7 (adr/0031): a parcel's label, staff only; integration keys cannot fetch it. */
export const SHIPPING_ROUTES = [
  {
    matcher: "/admin/orders/:id/fulfillments/:fulfillment_id/label",
    methods: ["GET" as const],
    middlewares: [requireUserActor],
  },
]
