import { defineMiddlewares, validateAndTransformQuery } from "@medusajs/framework/http"
import {
  StoreGetTrDistricts,
  StoreGetTrNeighborhoods,
  StoreGetTrProvinces,
} from "./store/tr-address/validators"

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
  ],
})
