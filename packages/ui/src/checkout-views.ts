import type { TurnstileAsk } from "@qticaret/types"
import type { GatedChallenge } from "./lib/gate"
import type { LineAddonView } from "./addon-views"
import type { BookingHoldView, CartLineBookingView, OrderBookingView } from "./booking-views"
import type { TaxLinesView } from "./cart-views"
import type { TravelersStepView } from "./traveler-views"
import type { BreadcrumbView, ImageView, LinkView } from "./views"

/**
 * The checkout's and the order's view models (D7, adr/0046 §7). Amounts
 * come formatted; what can be paid, chosen or accepted is the backend's.
 */

export interface OptionView {
  value: string
  label: string
}

/** The address form's values, as the cart holds them or as the shopper last sent them. */
export interface AddressFormValues {
  email: string
  phone: string
  first_name: string
  last_name: string
  /** The province's plate ("6"), the district's and neighbourhood's ids: the selects' values. */
  province: string
  district: string
  neighborhood: string
  address_1: string
}

export interface AddressStepView {
  values: AddressFormValues
  provinces: OptionView[]
  /** The chosen province's districts and the chosen district's neighbourhoods, when known. */
  districts: OptionView[]
  neighborhoods: OptionView[]
}

/** A filled address, for reading: name, lines, phone. */
export interface AddressSummaryView {
  email: string
  name: string
  lines: string[]
  phone: string
}

export interface ShippingOptionView {
  id: string
  name: string
  /** "90,00 TL" or "Ücretsiz", in words. */
  price: string
  /** The delivery promise ("2-4 iş günü"), when the shop wrote one. */
  detail: string | null
}

/** `credit`: nothing left to pay, the cart's gift cards cover it (F4.8). */
export type PaymentKind = "card" | "bank_transfer" | "cash_on_delivery" | "credit"

export interface PaymentMethodView {
  /** The provider the session starts with (`pp_paytr_paytr`…). */
  id: string
  kind: PaymentKind
  label: string
  /** A line under it: installments, the bank's name, the fee. */
  detail: string | null
  /**
   * A quieter line under the detail: where the rest is shown (the card's
   * installments on the provider's form, once its number is in; owner
   * 2026-11-05). None: nothing more to say.
   */
  note?: string | null
}

/** A contract the shopper accepts before paying, rendered by the backend (allow-listed HTML). */
export interface ContractView {
  kind: string
  version: number
  title: string
  html: string
}

export interface CheckoutLineView {
  id: string
  title: string
  detail: string | null
  quantity: number
  /** KDV included; without it when the summary carries `tax` (a wholesaler's, ADR-0068 §5). */
  total: string
  image: ImageView | null
  /** The product's page with the line's variant chosen; null or absent: plain text (as the cart's). */
  path?: string | null
  /** The line's add-on picks (adr/0052). */
  addons?: LineAddonView[]
  /** A dated line's departure and whether its places are still held (adr/0076 §10); absent otherwise. */
  booking?: CartLineBookingView | null
}

export interface CheckoutSummaryView {
  lines: CheckoutLineView[]
  items: string
  discount: string | null
  /** What gift cards take off, in words; null when none. */
  credit?: string | null
  /** Null until a shipping method is chosen. */
  shipping: string | null
  /**
   * False: nothing in the basket is shipped (digital and service lines, a
   * gift card; adr/0076 §6), so no shipping row at all. Absent or true:
   * the row as `shipping` says it.
   */
  ships?: boolean
  total: string
  /**
   * A wholesaler's basket (ADR-0068 §5): the lines and items without KDV
   * (the discount too), the KDV on the items as a line of its own; the
   * shipping and the total as they are. Absent for every other shopper.
   */
  tax?: TaxLinesView | null
  /**
   * The hold on the dated lines' places (adr/0076 §10): "Yerleriniz MM:SS
   * daha tutuluyor" in the summary; run out, the payment button is drawn
   * off. Absent or null: no dated lines.
   */
  hold?: BookingHoldView | null
  /**
   * A note above the summary, in words (a shipping method left on a cart
   * that ships nothing any more, adr/0076 Ek D3). Absent or null: none.
   */
  notice?: string | null
}

/** `travelers`: a dated product's travelers, before the payment (adr/0076 §7); only when asked. */
export type CheckoutStep = "address" | "shipping" | "travelers" | "payment"

export interface CheckoutPageView {
  /** The step open for editing; the ones before it show their summary. */
  step: CheckoutStep
  /**
   * The steps this cart takes, in order (adr/0076 §6, K7). Absent: all
   * three, as before. A cart with nothing to ship has no `shipping` step;
   * its address step then asks for the invoice and contact details (the
   * same fields, its own title). A theme draws no step that is not listed.
   * `travelers` is listed only when a dated line asks for them (Ek D6b).
   */
  steps?: CheckoutStep[]
  /**
   * The travelers step's departures and what each asks (adr/0076 Ek D6b);
   * absent or null: the cart asks for none.
   */
  travelers?: TravelersStepView | null
  address: AddressStepView
  /** The address as saved, once it is. */
  addressSummary: AddressSummaryView | null
  shippingOptions: ShippingOptionView[]
  shippingSelected: string | null
  /** The chosen method's name and price, once chosen. */
  shippingSummary: string | null
  paymentMethods: PaymentMethodView[]
  /** The contracts for each way of paying (their text names it); accepted before paying. */
  contracts: Partial<Record<PaymentKind, ContractView[]>>
  /** The age the cart asks the buyer to declare; null when it asks none. */
  ageLimit: number | null
  /** The text version of the marketing consent offered with the order. */
  marketingVersion: string
  /**
   * The shopper's note for the shop kept on the cart (Batch 8 / O1), to fill
   * the field again; the payment form sends it back as `order_note`.
   */
  orderNote?: string | null
  summary: CheckoutSummaryView
  /**
   * The coupon codes on the cart, each removable beside the summary; null
   * or left out: no code field (a payment link's cart, adr/0051).
   */
  promotions?: string[] | null
  /** A message already in words, after a failed step. */
  error: string | null
  /** Each step's own address, to reopen it. */
  editPaths: Record<Exclude<CheckoutStep, "travelers">, string> & { travelers?: string }
  /** Who the invoice is made out to, in words, and where to change it (F8 billing profile). */
  invoice: { text: string; link: { label: string; path: string } | null }
}

/** What the place-order form hears back: an error, or a challenge to solve and send again. */
export interface PlaceOrderResult {
  ok: boolean
  error: string | null
  /**
   * The proof of work the backend asked for (adr/0044); the form solves it
   * and posts again (`fallback`: in Turnstile's stead, adr/0044 Ek 2026-11-24).
   */
  challenge: GatedChallenge | null
  /** Turnstile wanted (a 428) or refused (a 403): the form gets a token, or a fresh one. */
  turnstile?: TurnstileAsk | null
}

/** A gift card's balance asked by its code, or why not. */
export interface GiftBalanceResult extends PlaceOrderResult {
  /** "Kalan bakiye: 250,00 TL", in words; null without an answer. */
  balance: string | null
}

export interface PaymentFramePageView {
  /** The provider's hosted form (an allowed origin only). */
  frameUrl: string
  summary: CheckoutSummaryView
  backPath: string
}

export interface CheckoutResultPageView {
  /** Waiting for the notice; refused; waiting too long; paid but not ordered (refunded). */
  state: "pending" | "failed" | "late" | "refund"
  /** Where the pending page looks again, for its refresh. */
  retryPath: string | null
  backPath: string
  /** The way on's words; absent: the theme's own for the state. */
  backLabel?: string
  /** A second way, as a plain link: the order lookup, the shop's contact page. */
  help?: { path: string; label: string } | null
}

export interface OrderLineView {
  title: string
  detail: string | null
  quantity: number
  total: string
  image: ImageView | null
  /** The product's page with the line's variant chosen; null or absent: gone or hidden, plain text. */
  path?: string | null
  /** A gift card line (adr/0025 Ek 2026-11-03): its cards' last four and the recipient's address. */
  gift?: OrderGiftView | null
  /** The line's add-on picks as sold (adr/0052). */
  addons: LineAddonView[]
  /** A pick made to the buyer's wish: no withdrawal, only a faulty or wrong item comes back. */
  nonWithdrawable: boolean
}

export interface OrderGiftView {
  /** The issued cards' last four characters; none until the payment is in. */
  cards: string[]
  /** Where the cards go; null when the line names no one (they go to the order's address). */
  recipient: string | null
}

/** Why a line is outside the right of withdrawal, as the backend names it (adr/0025, adr/0052 §8). */
export type WithdrawalExclusion = "product" | "personal_addon" | "gift_card_used"

/**
 * What a line inside the right of withdrawal warns of (adr/0032 Ek
 * 2026-11-03): `sealed_goods`, a hygiene good back only with its seal
 * unopened (MSY md. 15/1-ç); refused at receipt if opened.
 */
export type WithdrawalWarning = "sealed_goods"

export interface ReturnableLineView {
  id: string
  title: string
  /**
   * Units that may still be asked back, as the backend counts them
   * (`GET /store/orders/:id/returnable`): a gift line's cards not asked
   * for yet; 0 for a gift line whose cards were spent.
   */
  quantity: number
  /**
   * Outside the right of withdrawal: back only as faulty or wrong; a gift
   * line whose cards were spent (`gift_card_used`) not at all. Null inside it.
   */
  excluded?: WithdrawalExclusion | null
  /**
   * Inside the right of withdrawal with a condition (`sealed_goods`): the
   * line may be chosen like any other, its `note` says the condition.
   */
  warning?: WithdrawalWarning | null
  /** A gift card line: asked on its own and as money back, its cards voided, nothing sent. */
  gift?: boolean
  /**
   * Under the line, in words: why it has no right of withdrawal, what its
   * warning means, or what a gift line's withdrawal does.
   */
  note?: string | null
  /** The other variants an exchange may go for (value: variant id); none: not exchanged. */
  variants?: OptionView[]
}

export interface BankTransferView {
  accountHolder: string
  bankName: string
  iban: string
  amount: string
  deadlineHours: number
}

export interface OrderPageView {
  displayId: string
  /** "1 Kasım 2026 14:05", in words. */
  placedAt: string
  /** Fresh from checkout: the page thanks the shopper. */
  fresh: boolean
  email: string
  status: string
  paymentStatus: string
  /** What the shopper still has to do, for a transfer not yet paid. */
  bankTransfer: BankTransferView | null
  cashOnDelivery: boolean
  lines: OrderLineView[]
  items: string
  discount: string | null
  shipping: string
  total: string
  address: AddressSummaryView | null
  /** The order's contracts and invoice, as links on the shop. */
  documents: LinkView[]
  breadcrumbs: BreadcrumbView[]
  /** The order's key from its link, carried by its forms; null for the signed-in customer's own. */
  token: string | null
  orderId: string
  /**
   * Not packed yet, and no gift card it sent was used: the shopper may
   * cancel (the backend decides again). Untouched cards are voided with it.
   */
  cancellable: boolean
  /** Above the cancel button, in words: an order with gift card lines says its cards are voided too. */
  cancelText?: string
  /** Not cancellable, in words where the button would be (money taken by hand, a card used). */
  cancelNote?: string | null
  /**
   * The lines that may be asked back, as the backend counts them
   * (`GET /store/orders/:id/returnable`); null when none may or the
   * window is shut: a shipped order's lines, and a gift card line whose
   * cards went out, whatever the parcels. A line outside the right of
   * withdrawal comes back only for a reason in `defectReasons`; a gift
   * line on its own (`giftReasons`).
   */
  returnable: ReturnableLineView[] | null
  returnReasons: OptionView[]
  /** The reasons that are the shop's fault (faulty, wrong, not as described): `returnReasons` values. */
  defectReasons?: string[]
  /** The reasons a gift card line is withdrawn for: the right of withdrawal only. */
  giftReasons?: OptionView[]
  /**
   * On the shipped lines' form, in words: what sending them back costs
   * (nothing with the shop's carrier, MSY md. 12/5); null or left out: no line.
   */
  returnShippingNote?: string | null
  /**
   * Return requests already made, in words; `refused`: the units refused at
   * receipt and why, a line each ("… 1 adet ambalajı açılmış…").
   */
  returns: { kind: string; status: string; date: string; code: string | null; refused?: string[] }[]
  /** The parcels that left, in words: carrier, tracking and where they are. */
  shipments: {
    carrier: string | null
    trackingNumber: string | null
    trackingUrl: string | null
    /** "Yolda · 2 Kasım 14:05", the carrier's last word or when it left. */
    status: string
    items: string
  }[]
  /** A message already in words after an action (cancelled, request received, refused). */
  notice: string | null
  /**
   * Where the order stands, step by step (adr/0046 Ek 2026-11-05): placed,
   * paid (none for cash on delivery), packed, shipped, delivered. Null or
   * left out: a cancelled order, or a storefront that does not say.
   */
  progress?: OrderStepView[] | null
  /** How it is paid, in words ("Kredi / banka kartı", "Havale / EFT"); null when unknown. */
  payment?: string | null
  /** Opened by a shopper not signed in: the page may offer an account. */
  guest?: boolean
  /**
   * A dated order's departures, each with its cancel asked first and then
   * confirmed (adr/0076 Ek D7a). Null or left out: not a dated order, and
   * the page is drawn as before.
   */
  bookings?: OrderBookingView[] | null
  /**
   * The order's printable booking voucher (adr/0076 Ek D7b), with the
   * order's key when it was opened with one; shown beside the departures.
   * Null or left out: no voucher (not dated, or the shop gives none), and
   * the page is drawn as before.
   */
  voucherPath?: string | null
}

export type OrderStepKey = "placed" | "paid" | "packed" | "shipped" | "delivered"

/** One step of an order's way: its words, whether it is behind, now or ahead, and when it happened. */
export interface OrderStepView {
  key: OrderStepKey
  label: string
  state: "done" | "current" | "ahead"
  /** "2 Kasım 2026 14:05" once done, when the backend knows; else null. */
  at: string | null
}

export interface OrderActions {
  /** A plain form: `order_id`, `token`. */
  cancelOrder: (form: FormData) => Promise<void>
  /** Fields: `order_id`, `token`, `kind`, `reason`, `note`, `qty_<line id>`. */
  requestReturn: (
    state: { ok: boolean; error: string | null },
    form: FormData
  ) => Promise<{ ok: boolean; error: string | null }>
  /**
   * One departure of a dated order cancelled (adr/0076 Ek D7a). A plain
   * form: `order_id`, `token`, `slot_id`; never an amount. Left out: the
   * storefront does not offer it.
   */
  cancelBooking?: (form: FormData) => Promise<void>
}
