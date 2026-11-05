import "server-only"
import { formatLira } from "@qticaret/ui"
import type {
  AccountPageView,
  AddressSummaryView,
  CheckoutPageView,
  CheckoutStep,
  ContractView,
  PaymentKind,
  PaymentMethodView,
  Translate,
} from "@qticaret/ui"
import {
  districtOptions,
  neighborhoodOptions,
  provinceOptions,
  selectsOf,
} from "@/lib/checkout/address"
import { addressComplete } from "@/lib/checkout/cart"
import { CREDIT_CHECKOUT } from "@/lib/checkout/pay"
import type { CheckoutAddress, CheckoutCart } from "@/lib/checkout/cart"
import {
  ageCheck,
  contracts,
  maxInstallments,
  optionPrice,
  paymentMethods,
  shippingOptions,
} from "@/lib/checkout/options"
import type { PaymentMethods } from "@/lib/checkout/options"
import { summaryOf } from "./checkout-summary"
import { displayPhone } from "./frame"
import { productPathsOf } from "./line-paths"

export { summaryOf } from "./checkout-summary"

/** The text version of the marketing consent the checkout offers (F10). */
export const MARKETING_TEXT_VERSION = "checkout-1"

export const STEP_PATHS: Record<CheckoutStep, string> = {
  address: "/odeme?adim=adres",
  shipping: "/odeme?adim=kargo",
  payment: "/odeme",
}

const STEP_OF: Record<string, CheckoutStep> = {
  adres: "address",
  kargo: "shipping",
  odeme: "payment",
}

const ORDER: CheckoutStep[] = ["address", "shipping", "payment"]

/** The step to open: the one asked for, never past the first one still missing. */
export function stepOf(cart: CheckoutCart, asked: string | undefined): CheckoutStep {
  const reachable: CheckoutStep = !addressComplete(cart)
    ? "address"
    : cart.shipping_methods.length === 0
      ? "shipping"
      : "payment"
  const wanted = (asked ? STEP_OF[asked] : undefined) ?? reachable
  return ORDER.indexOf(wanted) <= ORDER.indexOf(reachable) ? wanted : reachable
}

export function addressSummaryOf(
  email: string | null,
  address: CheckoutAddress | null
): AddressSummaryView | null {
  if (!email || !address) {
    return null
  }
  const place = [address.address_2, address.city, address.province].filter(Boolean).join(", ")
  return {
    email,
    name: [address.first_name, address.last_name].filter(Boolean).join(" "),
    lines: [address.address_1 ?? "", [place, address.postal_code].filter(Boolean).join(" ")],
    phone: address.phone ? displayPhone(address.phone) : "",
  }
}

/** The one card provider offered: the shop's first that is not down, else its first. */
export function cardProviderOf(methods: PaymentMethods): string | null {
  const up = methods.card_providers.find((id) => !methods.card_providers_down.includes(id))
  return up ?? methods.card_providers[0] ?? null
}

function methodViews(
  methods: PaymentMethods,
  installments: number,
  t: Translate
): PaymentMethodView[] {
  const views: PaymentMethodView[] = []
  const card = cardProviderOf(methods)
  if (card) {
    views.push({
      id: card,
      kind: "card",
      label: t("checkout.pay_card"),
      detail:
        installments > 1
          ? t("checkout.pay_card_installments", { count: installments })
          : t("checkout.pay_card_single"),
    })
  }
  if (methods.bank_transfer) {
    views.push({
      id: methods.bank_transfer.provider_id,
      kind: "bank_transfer",
      label: t("checkout.pay_bank"),
      detail: t("checkout.pay_bank_detail", {
        bank: methods.bank_transfer.bank_name,
        hours: methods.bank_transfer.deadline_hours,
      }),
    })
  }
  if (methods.cash_on_delivery) {
    views.push({
      id: methods.cash_on_delivery.provider_id,
      kind: "cash_on_delivery",
      label: t("checkout.pay_cod"),
      detail: t("checkout.pay_cod_detail", {
        fee: formatLira(methods.cash_on_delivery.fee),
      }),
    })
  }
  return views
}

/** The payment step's offer: ways to pay, their contracts, an age to declare. */
/** Nothing left to pay (F4.8): the gift cards' way, alone. */
const creditView = (t: Translate): PaymentMethodView => ({
  id: CREDIT_CHECKOUT,
  kind: "credit",
  label: t("checkout.pay_credit"),
  detail: t("checkout.pay_credit_detail"),
})

async function paymentStep(cart: CheckoutCart, t: Translate) {
  const nothingDue = cart.total === 0
  const [methods, installments, age] = await Promise.all([
    nothingDue ? null : paymentMethods(cart.id),
    nothingDue ? 0 : maxInstallments(cart.id),
    ageCheck(cart.id),
  ])
  const views = methods ? methodViews(methods, installments, t) : [creditView(t)]
  const kinds = [...new Set(views.map((view) => view.kind))]
  const texts = await Promise.all(kinds.map((kind) => contracts(cart.id, kind)))
  const byKind: Partial<Record<PaymentKind, ContractView[]>> = Object.fromEntries(
    kinds.map((kind, index) => [kind, texts[index] ?? []])
  )
  return {
    paymentMethods: views,
    contracts: byKind,
    ageLimit: age.required && !age.declared ? age.min_age : null,
  }
}

/** What a signed-in customer's account already knows, for an empty address form. */
export interface CustomerDefaults {
  email: string
  first_name: string | null
  last_name: string | null
  phone: string | null
  /** The newest address in the customer's book. */
  address: CheckoutAddress | null
}

type Billing = AccountPageView["billing"]

/** Who the invoice goes to (F8): the account's billing profile, or the delivery name. */
export function invoiceNoteOf(
  t: Translate,
  signedIn: boolean,
  billing: Billing
): CheckoutPageView["invoice"] {
  if (!signedIn) {
    return {
      text: t("checkout.invoice_guest"),
      link: { label: t("checkout.invoice_sign_in"), path: "/hesap/giris?sonra=%2Fodeme" },
    }
  }
  const change = { label: t("checkout.invoice_change"), path: "/hesap/bilgiler#fatura" }
  if (!billing) {
    return {
      text: t("checkout.invoice_default"),
      link: { ...change, label: t("checkout.invoice_add") },
    }
  }
  return {
    text:
      billing.type === "corporate"
        ? t("checkout.invoice_corporate", {
            name: billing.legalName,
            office: billing.taxOffice,
            tax: billing.taxIdMasked ?? "",
          })
        : t("checkout.invoice_individual", { name: billing.legalName }),
    link: change,
  }
}

export async function checkoutView(
  cart: CheckoutCart,
  step: CheckoutStep,
  error: string | null,
  t: Translate,
  customer: CustomerDefaults | null = null,
  billing: Billing = null
): Promise<CheckoutPageView> {
  const address = cart.shipping_address
  // An empty form starts from the customer's newest saved address
  // (a cart Medusa gave the customer may carry an empty address object)
  const known = address?.province ? address : (customer?.address ?? address ?? null)
  const selects = known ? await selectsOf(known) : { province: "", district: "", neighborhood: "" }
  const complete = addressComplete(cart)
  const chosen = cart.shipping_methods[0] ?? null
  const [provinces, districts, neighborhoods, options, payment, paths] = await Promise.all([
    provinceOptions(),
    selects.province ? districtOptions(selects.province) : [],
    selects.district ? neighborhoodOptions(selects.district) : [],
    complete ? shippingOptions(cart.id) : [],
    complete && chosen
      ? paymentStep(cart, t)
      : { paymentMethods: [], contracts: {}, ageLimit: null },
    productPathsOf(cart.items),
  ])
  return {
    step,
    address: {
      values: {
        email: cart.email ?? customer?.email ?? "",
        phone: displayPhone(known?.phone ?? customer?.phone ?? ""),
        first_name: known?.first_name ?? customer?.first_name ?? "",
        last_name: known?.last_name ?? customer?.last_name ?? "",
        ...selects,
        address_1: known?.address_1 ?? "",
      },
      provinces,
      districts,
      neighborhoods,
    },
    addressSummary: complete ? addressSummaryOf(cart.email, address) : null,
    shippingOptions: options.map((option) => {
      const price = optionPrice(option)
      return {
        id: option.id,
        name: option.name,
        price:
          price === null
            ? t("checkout.price_unknown")
            : price > 0
              ? formatLira(price)
              : t("checkout.free"),
        detail: option.type?.description ?? null,
      }
    }),
    shippingSelected: chosen?.shipping_option_id ?? null,
    shippingSummary: chosen
      ? `${chosen.name} · ${chosen.total > 0 ? formatLira(chosen.total) : t("checkout.free")}`
      : null,
    ...payment,
    marketingVersion: MARKETING_TEXT_VERSION,
    summary: summaryOf(cart, t, paths),
    error,
    editPaths: STEP_PATHS,
    invoice: invoiceNoteOf(t, customer !== null, billing),
  }
}
