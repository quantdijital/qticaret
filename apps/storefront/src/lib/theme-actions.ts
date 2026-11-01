import type {
  AccountActions,
  AuthActions,
  CheckoutActions,
  OrderActions,
  ThemeActions,
} from "@qticaret/ui"
import {
  forgotAction,
  loginAction,
  logoutAction,
  lookupAction,
  registerAction,
  resetAction,
  verifyAction,
} from "@/app/actions/account"
import { saveConsents, saveProfile } from "@/app/actions/account-profile"
import { addFavorite, removeFavorite, saveBilling } from "@/app/actions/favorites"
import { installmentsFor } from "@/app/actions/installments"
import { cancelOrder, requestReturn } from "@/app/actions/order"
import { requestPrivacy } from "@/app/actions/privacy"
import { askQuestion, stockAlert, writeReview } from "@/app/actions/product"
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
  writeReview,
  askQuestion,
  stockAlert,
  addFavorite,
  installments: installmentsFor,
}

/** The checkout's actions (D7). */
export const checkoutActions: CheckoutActions = {
  saveAddress,
  chooseShipping,
  placeOrder,
  districts: loadDistricts,
  neighborhoods: loadNeighborhoods,
}

/** Signing in and its kin (D8). */
export const authActions: AuthActions = {
  login: loginAction,
  register: registerAction,
  forgot: forgotAction,
  reset: resetAction,
  verify: verifyAction,
  lookup: lookupAction,
}

/** The signed-in customer's forms (D8). */
export const accountActions: AccountActions = {
  requestPrivacy,
  saveBilling,
  removeFavorite,
  saveProfile,
  saveConsents,
  logout: logoutAction,
}

/** An order's own forms: cancel, ask to return (F7). */
export const orderActions: OrderActions = { cancelOrder, requestReturn }
