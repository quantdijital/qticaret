import type { TurnstileAsk } from "@qticaret/types"
import type { GatedChallenge } from "./lib/gate"
import type { ComponentType, ReactNode } from "react"
import type { AccountActions, AccountPageView, AuthActions, AuthPageView } from "./account-views"
import type {
  CheckoutPageView,
  CheckoutResultPageView,
  GiftBalanceResult,
  OptionView,
  OrderActions,
  OrderPageView,
  PaymentFramePageView,
  PlaceOrderResult,
} from "./checkout-views"
import type { PaymentLinkPageView } from "./payment-link-views"
import type { SaveTravelers } from "./traveler-views"
import type {
  BlogIndexPageView,
  BrandsPageView,
  CartPageView,
  CategoriesPageView,
  ConfirmPageView,
  CookiePreferencesPageView,
  GiftCardBalancePageView,
  InstallmentFamilyView,
  ContentPageView,
  HomePageView,
  LegalPageView,
  ListingPageView,
  NotFoundPageView,
  ProductPageView,
  QuickViewSetup,
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
  /** A bot check the backend wants first (adr/0044 Ek 2026-11-24); `sendGated` answers it. */
  challenge?: GatedChallenge | null
  turnstile?: TurnstileAsk | null
  /** Fields to send again in place of what was sent (`GatedResult.resume`). */
  resume?: Record<string, string[]> | null
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
  /**
   * Fields: `product_id`, `rating` (1–5), `title`, `body`, and `photos`:
   * up to 3 image files (JPEG, PNG, WebP, AVIF; adr/0037 §4 Ek 2026-11-04),
   * so the form is `multipart/form-data`.
   */
  writeReview: FormAction
  /** Fields: `product_id`, `body`. */
  askQuestion: FormAction
  /** Fields: `variant_id`, `email` (a guest's), `challenge` (a solved proof of work). */
  stockAlert: (state: PlaceOrderResult, form: FormData) => Promise<PlaceOrderResult>
  /** Field: `product_id`; a signed-in customer saves the product. */
  addFavorite: FormAction
  /**
   * A variant's installment plans by card family, asked only when the
   * shopper opens them (the line under the price, `VariantView.installments`,
   * comes with the page); null: none to show.
   */
  installments: (variantId: string) => Promise<InstallmentFamilyView[] | null>
  /**
   * A gift card into the cart with its recipient (adr/0025 Ek 2026-11-03).
   * Fields: `variant_id`, `quantity`, `recipient_email`, `recipient_name`,
   * `message`, `sender_name`.
   */
  addGiftToCart?: FormAction
  /**
   * A plain form: a gift line's recipient, written again from the cart.
   * Fields: `line_id` and the recipient's, as above; a refusal comes back
   * to the cart with its message key.
   */
  saveGiftRecipient?: (form: FormData) => Promise<void>
  /**
   * A product with its add-on picks into the cart (adr/0052). Fields:
   * `product_id`, `variant_id`, `quantity`, `addon_<id>` (the text typed or
   * the choice's id; empty is none). Never a price.
   */
  addAddonsToCart?: FormAction
  /**
   * A plain form: a cart line's picks written again. Fields: `line_id`,
   * `product_id`, `addon_<id>` as above, or `clear=1` to take them all
   * off; a refusal comes back to the cart with its message key.
   */
  saveLineAddons?: (form: FormData) => Promise<void>
  /**
   * A dated product's departure into the cart (adr/0076 §5, K6). Fields:
   * `product_id`, `slot_id`, and `qty_<variant_id>` for each price
   * category (0 or empty is none). It sends that departure's lines whole:
   * sent again, they replace the ones in the cart. Never a price or a date.
   */
  addBookingToCart?: FormAction
  /**
   * A dated product's "call me" request (adr/0076 Ek 2026-11-23): no
   * payment, no places held; the shop calls back. Fields: `product_id`,
   * `name`, `phone`, `email` (optional), one of `slot_id`, `date`
   * (YYYY-MM-DD) or `month` (YYYY-MM) or none (open dates), `adults`,
   * `children`, `note`, `consent` (`1`), `challenge` (a solved proof
   * of work, when one was asked).
   */
  requestBooking?: (state: PlaceOrderResult, form: FormData) => Promise<PlaceOrderResult>
  /**
   * A plain form: a payment link's cart (adr/0051) let go, so the shopper
   * can shop anew; the link itself still opens from its message.
   */
  leaveLinkCart?: (form: FormData) => Promise<void>
}

/** `/hediye-karti/bakiye`'s form. */
export interface GiftCardActions {
  /** Fields: `code`, `challenge` (the solved proof of work, when one was asked). */
  checkBalance: (state: GiftBalanceResult, form: FormData) => Promise<GiftBalanceResult>
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
  /**
   * Field: `code`; a coupon on the cart from the order summary, the cart
   * page's own action (D6). Left out: the checkout offers no code field.
   */
  applyPromotion?: FormAction
  /** A plain form, field `code`: takes a code off; a refusal comes back to checkout with its key. */
  removePromotion?: (form: FormData) => Promise<void>
  /**
   * The travelers step's form (adr/0076 Ek D6b; fields in `SaveTravelers`).
   * Left out: no travelers step is drawn.
   */
  saveTravelers?: SaveTravelers
}

interface Page<View> {
  view: View
  t: Translate
}

/**
 * The page a request could not be made into (adr/0046 Ek 2026-11-05): a
 * client component a theme exports apart from its pages (its `/error`
 * entry), since Next draws it in the browser too, and with the backend
 * away (no frame then: the shop's frame needs its data). It takes no
 * data: the words, a way to try again and the way home.
 */
export type ThemeErrorPage = ComponentType<{ t: Translate; retry: () => void }>

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
    /**
     * The live search's address on the storefront (never the backend's,
     * adr/0046 §5): `GET {searchSuggest}?q=…` answers a `SearchSuggestView`.
     * None: the header's search is the plain form to `/arama` alone, as it
     * is anyway before the page's script runs.
     */
    searchSuggest?: string
    /**
     * The cart drawer's quantity and remove buttons (adr/0046 Ek
     * 2026-11-05): `ThemeActions.changeCartLine`, a plain form. None: the
     * drawer shows its lines read only.
     */
    changeCartLine?: (form: FormData) => Promise<void>
    /**
     * The cards' quick view (adr/0049 Ek 2026-11-15), given only while the
     * shop has it on: the dialog's address and form. None: no dialog, and a
     * card's button (if any) goes to the product's page.
     */
    quickView?: QuickViewSetup
  }>
  HomePage: ComponentType<
    Page<HomePageView> & {
      /** Fields: `email`, `challenge`: a newsletter section's box (double opt-in). */
      subscribe?: (state: PlaceOrderResult, form: FormData) => Promise<PlaceOrderResult>
      /** A card's quick add (adr/0046 Ek 2026-11-04): `addToCart`'s fields, quantity 1. */
      quickAdd?: FormAction
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
      /** A card's quick add (adr/0046 Ek 2026-11-04): `addToCart`'s fields, quantity 1. */
      quickAdd?: FormAction
    }
  >
  ContentPage: ComponentType<
    Page<ContentPageView> & {
      actions?: ContactActions
      /** A newsletter section's box among the page's own sections (adr/0073). */
      subscribe?: (state: PlaceOrderResult, form: FormData) => Promise<PlaceOrderResult>
      /** A card's quick add among the page's own sections: `addToCart`'s fields, quantity 1. */
      quickAdd?: FormAction
    }
  >
  /** `/yasal/{tür}`: one legal text with its table of contents and the others beside it. */
  LegalPage: ComponentType<Page<LegalPageView>>
  BlogIndexPage: ComponentType<Page<BlogIndexPageView>>
  /** `/kategoriler`: every category as a tree. */
  CategoriesPage: ComponentType<Page<CategoriesPageView>>
  /** `/markalar`: every brand by first letter. */
  BrandsPage: ComponentType<Page<BrandsPageView>>
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
  /** A 404; with `view`, the shop's categories to go on to (adr/0046 Ek 2026-11-05). */
  NotFoundPage: ComponentType<{ t: Translate; view?: NotFoundPageView }>
  /**
   * A page removed for good (410, a record deleted or a rule's 410; adr/0046
   * Ek 2026-11-05): the 404's sibling, in the shop's frame, with the same
   * ways on. The status code is the storefront's. None: `NotFoundPage`.
   */
  GonePage?: ComponentType<{ t: Translate; view?: NotFoundPageView }>
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
  /** A gift card's balance by its code (adr/0025 Ek 2026-11-03). */
  GiftCardBalancePage: ComponentType<Page<GiftCardBalancePageView> & { actions: GiftCardActions }>
  /**
   * `/ode/<token>` (adr/0051): the order staff prepared, and "Ödemeye geç",
   * a plain form (field `token`) that opens it as the cart at checkout.
   */
  PaymentLinkPage: ComponentType<
    Page<PaymentLinkPageView> & { action: (form: FormData) => Promise<void> }
  >
}
