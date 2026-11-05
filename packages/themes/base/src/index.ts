import type { StorefrontTheme } from "@qticaret/ui"
import { AccountPage } from "./AccountPage"
import { AuthPage } from "./AuthPage"
import { BlogIndexPage } from "./BlogIndexPage"
import { BrandsPage } from "./BrandsPage"
import { CartPage } from "./CartPage"
import { CategoriesPage } from "./CategoriesPage"
import { CheckoutPage } from "./CheckoutPage"
import { ConfirmPage } from "./ConfirmPage"
import { CheckoutResultPage } from "./CheckoutResultPage"
import { ContentPage } from "./ContentPage"
import { CookiePreferencesPage } from "./CookiePreferencesPage"
import { GiftCardBalancePage } from "./GiftCardBalancePage"
import { HomePage } from "./HomePage"
import { LegalPage } from "./LegalPage"
import { Layout } from "./Layout"
import { ListingPage } from "./ListingPage"
import { GonePage, NotFoundPage } from "./NotFoundPage"
import { OrderPage } from "./OrderPage"
import { PaymentFramePage } from "./PaymentFramePage"
import { PaymentLinkPage } from "./PaymentLinkPage"
import { ProductPage } from "./ProductPage"
import { ReviewsPage } from "./ReviewsPage"

/** The first theme (adr/0046 §7): sector-neutral, mobile first, no script but the menus and the purchase form. */
export const baseTheme: StorefrontTheme = {
  name: "base",
  Layout,
  HomePage,
  ProductPage,
  ListingPage,
  ContentPage,
  LegalPage,
  BlogIndexPage,
  CategoriesPage,
  BrandsPage,
  CartPage,
  CheckoutPage,
  PaymentFramePage,
  CheckoutResultPage,
  OrderPage,
  AuthPage,
  AccountPage,
  NotFoundPage,
  GonePage,
  ConfirmPage,
  CookiePreferencesPage,
  ReviewsPage,
  GiftCardBalancePage,
  PaymentLinkPage,
}

/** A section another theme may borrow until it draws its own (adr/0046 Ek 2026-11-05). */
export { FeaturedProductSection } from "./home/FeaturedProductSection"

/**
 * Parts another theme may borrow for flows it does not draw yet
 * (adr/0046 Ek 2026-11-05): a gift line's recipient and a line's add-on
 * picks in the cart, the order's return request.
 */
export { AddonEditor } from "./cart/AddonEditor"
export { GiftRecipient } from "./cart/GiftRecipient"
export { OrderReturns } from "./account/OrderReturns"
export { OrderGift } from "./checkout/OrderGift"
