import { defineMiddlewares, validateAndTransformQuery } from "@medusajs/framework/http"
import {
  StoreGetTrDistricts,
  StoreGetTrNeighborhoods,
  StoreGetTrProvinces,
} from "./store/tr-address/validators"
import {
  ROOT,
  existingCartAddresses,
  existingCustomerAddress,
  validateTrAddresses,
} from "./validation/tr-address"

const CART_ADDRESSES = ["shipping_address", "billing_address"] as const

export default defineMiddlewares({
  routes: [
    {
      matcher: "/store/tr-address/provinces",
      methods: ["GET"],
      middlewares: [validateAndTransformQuery(StoreGetTrProvinces, {})],
    },
    {
      matcher: "/store/tr-address/districts",
      methods: ["GET"],
      middlewares: [validateAndTransformQuery(StoreGetTrDistricts, {})],
    },
    {
      matcher: "/store/tr-address/neighborhoods",
      methods: ["GET"],
      middlewares: [validateAndTransformQuery(StoreGetTrNeighborhoods, {})],
    },
    // F1.4: Turkish address checks on core routes; they run after Medusa's
    // own authentication and body validation for these routes.
    {
      matcher: "/store/customers/me/addresses",
      methods: ["POST"],
      middlewares: [validateTrAddresses([ROOT])],
    },
    {
      matcher: "/store/customers/me/addresses/:address_id",
      methods: ["POST"],
      middlewares: [validateTrAddresses([ROOT], existingCustomerAddress)],
    },
    {
      matcher: "/store/carts",
      methods: ["POST"],
      middlewares: [validateTrAddresses([...CART_ADDRESSES])],
    },
    {
      matcher: "/store/carts/:id",
      methods: ["POST"],
      middlewares: [validateTrAddresses([...CART_ADDRESSES], existingCartAddresses)],
    },
  ],
})
