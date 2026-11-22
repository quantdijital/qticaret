import type {
  AccountActions,
  AuthActions,
  CheckoutActions,
  GiftCardActions,
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
import { addAddress, removeAddress } from "@/app/actions/addresses"
import { addAddonsToCart, saveLineAddons } from "@/app/actions/addons"
import { addBookingToCart } from "@/app/actions/booking"
import { requestBooking } from "@/app/actions/booking-request"
import { addGiftToCart, checkGiftCardBalance, saveGiftRecipient } from "@/app/actions/gift-cards"
import { cancelBooking, cancelOrder, requestReturn } from "@/app/actions/order"
import { leaveLinkCart } from "@/app/actions/payment-link"
import { requestPrivacy } from "@/app/actions/privacy"
import { saveTravelers } from "@/app/actions/travelers"
import { askQuestion, stockAlert, writeReview } from "@/app/actions/product"
import {
  addToCart,
  applyGiftCard,
  applyPromotion,
  changeCartLine,
  removeCartGiftCard,
  removeCartPromotion,
  removeCheckoutPromotion,
} from "@/app/actions/cart"
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
  applyGiftCard,
  removeGiftCard: removeCartGiftCard,
  writeReview,
  askQuestion,
  stockAlert,
  addFavorite,
  installments: installmentsFor,
  addGiftToCart,
  saveGiftRecipient,
  addAddonsToCart,
  saveLineAddons,
  addBookingToCart,
  requestBooking,
  leaveLinkCart,
}

/** `/hediye-karti/bakiye`'s form (adr/0025 Ek 2026-11-03). */
export const giftCardActions: GiftCardActions = { checkBalance: checkGiftCardBalance }

/** The checkout's actions (D7); the code field beside its summary uses the cart's own. */
export const checkoutActions: CheckoutActions = {
  saveAddress,
  chooseShipping,
  placeOrder,
  districts: loadDistricts,
  neighborhoods: loadNeighborhoods,
  applyPromotion,
  removePromotion: removeCheckoutPromotion,
  saveTravelers,
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
  removeAddress,
  addAddress,
  districts: loadDistricts,
  neighborhoods: loadNeighborhoods,
  requestPrivacy,
  saveBilling,
  removeFavorite,
  saveProfile,
  saveConsents,
  logout: logoutAction,
}

/** An order's own forms: cancel, ask to return (F7). */
export const orderActions: OrderActions = { cancelOrder, requestReturn, cancelBooking }
