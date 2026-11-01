import type { StorefrontTheme } from "@qticaret/ui"
import { BlogIndexPage } from "./BlogIndexPage"
import { CartPage } from "./CartPage"
import { ContentPage } from "./ContentPage"
import { HomePage } from "./HomePage"
import { Layout } from "./Layout"
import { ListingPage } from "./ListingPage"
import { NotFoundPage } from "./NotFoundPage"
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
  NotFoundPage,
}
