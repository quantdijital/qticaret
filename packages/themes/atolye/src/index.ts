import {
  BrandsPage,
  ConfirmPage,
  CookiePreferencesPage,
  GiftCardBalancePage,
  PaymentLinkPage,
} from "@qticaret/theme-base/borrow"
import type { StorefrontTheme } from "@qticaret/ui"
import { AccountPage } from "./account/AccountPage"
import { AuthPage } from "./account/AuthPage"
import { CartPage } from "./cart/CartPage"
import { CategoriesPage } from "./CategoriesPage"
import { CheckoutPage } from "./checkout/CheckoutPage"
import { CheckoutResultPage } from "./checkout/CheckoutResultPage"
import { BlogIndexPage } from "./content/BlogIndexPage"
import { ContentPage } from "./content/ContentPage"
import { GonePage, NotFoundPage } from "./content/NotFoundPage"
import { ReviewsPage } from "./content/ReviewsPage"
import { PaymentFramePage } from "./checkout/PaymentFramePage"
import { OrderPage } from "./order/OrderPage"
import { HomePage } from "./HomePage"
import { Layout } from "./Layout"
import { LegalPage } from "./LegalPage"
import { ListingPage } from "./ListingPage"
import { ProductPage } from "./ProductPage"

/**
 * The theme selected as `atolye` (adr/0057), direction "Grafit"
 * (docs/tema/yon-2026-11-05.md): graphite stages for the shop's own
 * photographs on a cool steel-white counter, one heavy grotesk, the
 * shop's colour as the action. Sector-neutral; the shop's facts arrive
 * as data. Drawn so far: the frame, the home page, the legal texts, the
 * listings (category, brand, `/magaza`, sale, search), the category
 * index (`/kategoriler`), the product page
 * and the buying pages (cart, checkout, card form, payment result, the
 * order and its lookup), signing in and the customer's account; the
 * pages it has not drawn yet are the base
 * theme's, in this theme's tokens, borrowed one by one
 * (`@qticaret/theme-base/borrow`): taking `baseTheme` whole would ship
 * the base frame's client parts to every page (docs/21, 2026-11-06).
 */
export const atolyeTheme: StorefrontTheme = {
  name: "atolye",
  Layout,
  HomePage,
  LegalPage,
  CartPage,
  CheckoutPage,
  PaymentFramePage,
  CheckoutResultPage,
  OrderPage,
  AuthPage,
  AccountPage,
  ListingPage,
  CategoriesPage,
  ProductPage,
  ContentPage,
  BlogIndexPage,
  ReviewsPage,
  NotFoundPage,
  GonePage,
  BrandsPage,
  ConfirmPage,
  CookiePreferencesPage,
  GiftCardBalancePage,
  PaymentLinkPage,
}
