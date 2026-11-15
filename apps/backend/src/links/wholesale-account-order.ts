import OrderModule from "@medusajs/medusa/order"
import { defineLink } from "@medusajs/framework/utils"
import WholesaleModule from "../modules/wholesale"

/**
 * A wholesale order (ADR-0068 Ek 2026-11-15 (2)): the wholesaler who
 * placed it, written by the server when the order is created
 * (`workflows/hooks/complete-cart-wholesale-order.ts`) and never changed
 * after: closing the account later does not make it a retail order. One
 * wholesaler per order, many orders per wholesaler. Read by the panel's
 * order lists, which keep wholesale and retail orders apart. Deleting
 * either side removes the link only.
 */
export default defineLink(
  { linkable: OrderModule.linkable["order"], isList: true },
  WholesaleModule.linkable.wholesaleAccount
)
