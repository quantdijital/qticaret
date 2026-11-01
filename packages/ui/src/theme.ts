import type { ComponentType, ReactNode } from "react"
import type {
  CheckoutPageView,
  CheckoutResultPageView,
  OptionView,
  OrderPageView,
  PaymentFramePageView,
  PlaceOrderResult,
} from "./checkout-views"
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
  /** Form field: `code`; the answer says whether the code took. */
  applyPromotion: FormAction
  /** A plain form: `code`, taken off the cart. */
  removePromotion: (form: FormData) => Promise<void>
}

/** The checkout's actions (D7): each step a form, the address selects fed by two lookups. */
export interface CheckoutActions {
  /** Form fields: the address form's (`AddressFormValues`). */
  saveAddress: FormAction
  /** Form field: `option_id`. */
  chooseShipping: FormAction
  /**
   * Form fields: `provider_id`, `contracts` (`kind:version`, repeated),
   * `accept`, `birth_date` and `age_confirm` when asked, `marketing_email`,
   * `marketing_sms`, `challenge` (the solved proof of work, when one was asked).
   */
  placeOrder: (state: PlaceOrderResult, form: FormData) => Promise<PlaceOrderResult>
  /** A province's districts, by its plate. */
  districts: (province: string) => Promise<OptionView[]>
  /** A district's neighbourhoods, by its id. */
  neighborhoods: (district: string) => Promise<OptionView[]>
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
  CheckoutPage: ComponentType<Page<CheckoutPageView> & { actions: CheckoutActions }>
  /** The card provider's hosted form, framed on the shop (PayTR). */
  PaymentFramePage: ComponentType<Page<PaymentFramePageView>>
  /** After the provider sent the shopper back: waiting for the order, or a refused payment. */
  CheckoutResultPage: ComponentType<Page<CheckoutResultPageView>>
  OrderPage: ComponentType<Page<OrderPageView>>
  NotFoundPage: ComponentType<{ t: Translate }>
}
