import type { ComponentType, ReactNode } from "react"
import type { AccountActions, AccountPageView, AuthActions, AuthPageView } from "./account-views"
import type {
  CheckoutPageView,
  CheckoutResultPageView,
  OptionView,
  OrderActions,
  OrderPageView,
  PaymentFramePageView,
  PlaceOrderResult,
} from "./checkout-views"
import type {
  BlogIndexPageView,
  CartPageView,
  ConfirmPageView,
  CookiePreferencesPageView,
  InstallmentFamilyView,
  ContentPageView,
  HomePageView,
  ListingPageView,
  ProductPageView,
  ReviewsPageView,
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
  /** Form field: `code`, a gift card's (F4.8); the answer says whether it took. */
  applyGiftCard?: FormAction
  /** A plain form: `code`, the gift card taken off the cart. */
  removeGiftCard?: (form: FormData) => Promise<void>
  /** Fields: `product_id`, `rating` (1–5), `title`, `body`. */
  writeReview: FormAction
  /** Fields: `product_id`, `body`. */
  askQuestion: FormAction
  /** Fields: `variant_id`, `email` (a guest's), `challenge` (a solved proof of work). */
  stockAlert: (state: PlaceOrderResult, form: FormData) => Promise<PlaceOrderResult>
  /** Field: `product_id`; a signed-in customer saves the product. */
  addFavorite: FormAction
  /** A variant's installment plans, asked only when the shopper opens them (a call to the provider). */
  installments: (variantId: string) => Promise<InstallmentFamilyView[] | null>
}

/** The contact form's action (adr/0047). */
export interface ContactActions {
  /**
   * Fields: `name`, `email`, `phone`, `subject`, `order_number`, `body`,
   * `challenge` (the solved proof of work, when one was asked).
   */
  sendContact: (state: PlaceOrderResult, form: FormData) => Promise<PlaceOrderResult>
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
  Layout: ComponentType<{
    shop: ShopView
    t: Translate
    children: ReactNode
    /**
     * A plain form: `choice` (all, necessary, custom), `analytics`,
     * `marketing`, `policy_version`, and `return=preferences` from the page.
     */
    saveCookies: (form: FormData) => Promise<void>
    /** Fields: `email`, `challenge`; the footer's newsletter box (double opt-in). */
    subscribe?: (state: PlaceOrderResult, form: FormData) => Promise<PlaceOrderResult>
  }>
  HomePage: ComponentType<
    Page<HomePageView> & {
      /** Fields: `email`, `challenge`: a newsletter section's box (double opt-in). */
      subscribe?: (state: PlaceOrderResult, form: FormData) => Promise<PlaceOrderResult>
    }
  >
  ProductPage: ComponentType<
    Page<ProductPageView> & {
      actions: ThemeActions
      /** A newsletter section's box among the page's sections. */
      subscribe?: (state: PlaceOrderResult, form: FormData) => Promise<PlaceOrderResult>
    }
  >
  ListingPage: ComponentType<
    Page<ListingPageView> & {
      /** A newsletter section's box among the page's sections. */
      subscribe?: (state: PlaceOrderResult, form: FormData) => Promise<PlaceOrderResult>
    }
  >
  ContentPage: ComponentType<Page<ContentPageView> & { actions?: ContactActions }>
  BlogIndexPage: ComponentType<Page<BlogIndexPageView>>
  CartPage: ComponentType<Page<CartPageView> & { actions: ThemeActions }>
  CheckoutPage: ComponentType<Page<CheckoutPageView> & { actions: CheckoutActions }>
  /** The card provider's hosted form, framed on the shop (PayTR). */
  PaymentFramePage: ComponentType<Page<PaymentFramePageView>>
  /** After the provider sent the shopper back: waiting for the order, or a refused payment. */
  CheckoutResultPage: ComponentType<Page<CheckoutResultPageView>>
  OrderPage: ComponentType<Page<OrderPageView> & { actions: OrderActions }>
  /** Sign in, register, verify the e-mail, forget and reset the password (D8). */
  AuthPage: ComponentType<Page<AuthPageView> & { actions: AuthActions }>
  /** The signed-in customer's pages: overview, orders, details (D8). */
  AccountPage: ComponentType<Page<AccountPageView> & { actions: AccountActions }>
  NotFoundPage: ComponentType<{ t: Translate }>
  /** The shop's approved reviews across its products (D10). */
  ReviewsPage: ComponentType<Page<ReviewsPageView>>
  /**
   * Asks before acting on a link (D6 cart reminder; a message's unsubscribe,
   * consent and stock alert links), then says what happened; the action is
   * a plain form.
   */
  ConfirmPage: ComponentType<Page<ConfirmPageView> & { action: (form: FormData) => Promise<void> }>
  /**
   * The cookie choices on a page of their own (D9), where the footer's link
   * leads without script. The form is the banner's, with `return=preferences`.
   */
  CookiePreferencesPage: ComponentType<
    Page<CookiePreferencesPageView> & { save: (form: FormData) => Promise<void> }
  >
}
