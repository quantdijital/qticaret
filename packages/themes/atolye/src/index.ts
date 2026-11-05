import { baseTheme } from "@qticaret/theme-base"
import type { StorefrontTheme } from "@qticaret/ui"
import { CartPage } from "./cart/CartPage"
import { CheckoutPage } from "./checkout/CheckoutPage"
import { CheckoutResultPage } from "./checkout/CheckoutResultPage"
import { PaymentFramePage } from "./checkout/PaymentFramePage"
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
 * listings (category, brand, `/magaza`, sale, search) and the product
 * page; the pages it has not drawn yet are the base theme's, in this
 * theme's tokens.
 */
export const atolyeTheme: StorefrontTheme = {
  ...baseTheme,
  name: "atolye",
  Layout,
  HomePage,
  LegalPage,
  CartPage,
  CheckoutPage,
  PaymentFramePage,
  CheckoutResultPage,
  ListingPage,
  ProductPage,
}
