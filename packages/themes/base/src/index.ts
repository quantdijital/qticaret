import type { StorefrontTheme } from "@qticaret/ui"
import { AccountPage } from "./AccountPage"
import { AuthPage } from "./AuthPage"
import { BlogIndexPage } from "./BlogIndexPage"
import { CartPage } from "./CartPage"
import { CheckoutPage } from "./CheckoutPage"
import { CheckoutResultPage } from "./CheckoutResultPage"
import { ContentPage } from "./ContentPage"
import { HomePage } from "./HomePage"
import { Layout } from "./Layout"
import { ListingPage } from "./ListingPage"
import { NotFoundPage } from "./NotFoundPage"
import { OrderPage } from "./OrderPage"
import { PaymentFramePage } from "./PaymentFramePage"
import { ProductPage } from "./ProductPage"

/** The first theme (adr/0046 §7): sector-neutral, mobile first, no script but the menus and the purchase form. */
export const baseTheme: StorefrontTheme = {
  name: "base",
  Layout,
  HomePage,
  ProductPage,
  ListingPage,
  ContentPage,
  BlogIndexPage,
  CartPage,
  CheckoutPage,
  PaymentFramePage,
  CheckoutResultPage,
  OrderPage,
  AuthPage,
  AccountPage,
  NotFoundPage,
}
