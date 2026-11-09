import type { StorefrontTheme } from "@qticaret/ui"
import { AccountPage } from "./account/AccountPage"
import { AuthPage } from "./account/AuthPage"
import { BrandsPage } from "./BrandsPage"
import { CartPage } from "./cart/CartPage"
import { CategoriesPage } from "./CategoriesPage"
import { CheckoutPage } from "./checkout/CheckoutPage"
import { CheckoutResultPage } from "./checkout/CheckoutResultPage"
import { ConfirmPage } from "./ConfirmPage"
import { BlogIndexPage } from "./content/BlogIndexPage"
import { ContentPage } from "./content/ContentPage"
import { GonePage, NotFoundPage } from "./content/NotFoundPage"
import { ReviewsPage } from "./content/ReviewsPage"
import { CookiePreferencesPage } from "./CookiePreferencesPage"
import { GiftCardBalancePage } from "./GiftCardBalancePage"
import { PaymentFramePage } from "./checkout/PaymentFramePage"
import { OrderPage } from "./order/OrderPage"
import { HomePage } from "./HomePage"
import { Layout } from "./Layout"
import { LegalPage } from "./LegalPage"
import { ListingPage } from "./ListingPage"
import { PaymentLinkPage } from "./PaymentLinkPage"
import { ProductPage } from "./ProductPage"

/**
 * The storefront's theme (adr/0057, the only one since 2026-11-09; the
 * default when `STOREFRONT_THEME` is unset), direction "Grafit"
 * (docs/tema/yon-2026-11-05.md, `design.md`): graphite stages for the
 * shop's own photographs on a cool steel-white counter, one heavy
 * grotesk, the shop's colour as the action. Sector-neutral; the shop's
 * facts arrive as data. It draws every page of the contract: the frame,
 * the home page, the legal texts, the listings, the category and brand
 * indexes, the product page, the buying pages, the payment link,
 * signing in and the customer's account, the content pages and the
 * small pages (cookie preferences, a gift card's balance, a link's
 * confirmation).
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
