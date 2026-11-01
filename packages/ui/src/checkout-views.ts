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

export type PaymentKind = "card" | "bank_transfer" | "cash_on_delivery"

export interface PaymentMethodView {
  /** The provider the session starts with (`pp_paytr_paytr`…). */
  id: string
  kind: PaymentKind
  label: string
  /** A line under it: installments, the bank's name, the fee. */
  detail: string | null
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
  total: string
  image: ImageView | null
}

export interface CheckoutSummaryView {
  lines: CheckoutLineView[]
  items: string
  discount: string | null
  /** Null until a shipping method is chosen. */
  shipping: string | null
  total: string
}

export type CheckoutStep = "address" | "shipping" | "payment"

export interface CheckoutPageView {
  /** The step open for editing; the ones before it show their summary. */
  step: CheckoutStep
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
  summary: CheckoutSummaryView
  /** A message already in words, after a failed step. */
  error: string | null
  /** Each step's own address, to reopen it. */
  editPaths: Record<CheckoutStep, string>
  /** Who the invoice is made out to, in words, and where to change it (F8 billing profile). */
  invoice: { text: string; link: { label: string; path: string } | null }
}

/** What the place-order form hears back: an error, or a challenge to solve and send again. */
export interface PlaceOrderResult {
  ok: boolean
  error: string | null
  /** The proof of work the backend asked for (adr/0044); the form solves it and posts again. */
  challenge: { token: string; salt: string; bits: number } | null
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
}

export interface OrderLineView {
  title: string
  detail: string | null
  quantity: number
  total: string
  image: ImageView | null
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
  /** Not packed yet: the shopper may cancel (the backend decides again). */
  cancellable: boolean
  /** Shipped or delivered: the lines that may be asked back; null when none may. */
  returnable: { id: string; title: string; quantity: number }[] | null
  returnReasons: OptionView[]
  /** Return requests already made, in words. */
  returns: { kind: string; status: string; date: string; code: string | null }[]
  /** A message already in words after an action (cancelled, request received, refused). */
  notice: string | null
}

export interface OrderActions {
  /** A plain form: `order_id`, `token`. */
  cancelOrder: (form: FormData) => Promise<void>
  /** Fields: `order_id`, `token`, `kind`, `reason`, `note`, `qty_<line id>`. */
  requestReturn: (
    state: { ok: boolean; error: string | null },
    form: FormData
  ) => Promise<{ ok: boolean; error: string | null }>
}
