import type { ComponentType, ReactNode } from "react"
import type {
  BlogIndexPageView,
  CartPageView,
  ContentPageView,
  HomePageView,
  ListingPageView,
  ProductPageView,
  ShopView,
} from "./views"

/** The storefront's words, by key (`src/i18n/tr.json`); `{name}` placeholders filled. */
export type Translate = (key: string, values?: Record<string, string | number>) => string

/** What an action tells the form that sent it (React's `useActionState`). */
export interface ActionResult {
  ok: boolean
  /** A message key for the shopper, when something went wrong. */
  error: string | null
}

export type FormAction = (state: ActionResult, form: FormData) => Promise<ActionResult>

/** The storefront's actions a theme may wire to its forms (adr/0046 §7). */
export interface ThemeActions {
  /** Form fields: `variant_id`, `quantity`. */
  addToCart: FormAction
  /** A plain form: `line_id` and `quantity`, or `remove=1`. */
  changeCartLine: (form: FormData) => Promise<void>
}

interface Page<View> {
  view: View
  t: Translate
}

/**
 * A theme (adr/0046 §7): how pages look, nothing else. It fetches no data,
 * writes no SEO and decides no status code; the storefront calls it with
 * view models, the words and the actions.
 */
export interface StorefrontTheme {
  name: string
  Layout: ComponentType<{ shop: ShopView; t: Translate; children: ReactNode }>
  HomePage: ComponentType<Page<HomePageView>>
  ProductPage: ComponentType<Page<ProductPageView> & { actions: ThemeActions }>
  ListingPage: ComponentType<Page<ListingPageView>>
  ContentPage: ComponentType<Page<ContentPageView>>
  BlogIndexPage: ComponentType<Page<BlogIndexPageView>>
  CartPage: ComponentType<Page<CartPageView> & { actions: ThemeActions }>
  NotFoundPage: ComponentType<{ t: Translate }>
}
