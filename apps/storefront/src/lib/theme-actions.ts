import type { CheckoutActions, ThemeActions } from "@qticaret/ui"
import { addToCart, applyPromotion, changeCartLine, removeCartPromotion } from "@/app/actions/cart"
import {
  chooseShipping,
  loadDistricts,
  loadNeighborhoods,
  placeOrder,
  saveAddress,
} from "@/app/actions/checkout"

/** The storefront's Server Actions a theme wires to its forms (adr/0046 §7). */
export const themeActions: ThemeActions = {
  addToCart,
  changeCartLine,
  applyPromotion,
  removePromotion: removeCartPromotion,
}

/** The checkout's actions (D7). */
export const checkoutActions: CheckoutActions = {
  saveAddress,
  chooseShipping,
  placeOrder,
  districts: loadDistricts,
  neighborhoods: loadNeighborhoods,
}
