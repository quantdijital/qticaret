import "server-only"
import { formatLira } from "@qticaret/ui"
import type {
  AddressSummaryView,
  CheckoutPageView,
  CheckoutStep,
  CheckoutSummaryView,
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
import { displayPhone } from "./frame"

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

const kurus = (lira: number) => Math.round(lira * 100)

export function summaryOf(cart: CheckoutCart, t: Translate): CheckoutSummaryView {
  const discount = kurus(cart.original_item_total) - kurus(cart.item_total)
  return {
    lines: cart.items.map((line) => ({
      id: line.id,
      title: line.title,
      detail: line.variant_title ?? line.subtitle,
      quantity: line.quantity,
      total: formatLira(line.total),
      image: line.thumbnail
        ? {
            src: line.thumbnail,
            alt: line.title,
            width: null,
            height: null,
            sources: { avif: null, webp: null },
          }
        : null,
    })),
    items: formatLira(cart.original_item_total),
    discount: discount > 0 ? formatLira(discount / 100) : null,
    shipping:
      cart.shipping_methods.length === 0
        ? null
        : cart.shipping_total > 0
          ? formatLira(cart.shipping_total)
          : t("checkout.free"),
    total: formatLira(cart.total),
  }
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
async function paymentStep(cart: CheckoutCart, t: Translate) {
  const [methods, installments, age] = await Promise.all([
    paymentMethods(cart.id),
    maxInstallments(cart.id),
    ageCheck(cart.id),
  ])
  const views = methodViews(methods, installments, t)
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

export async function checkoutView(
  cart: CheckoutCart,
  step: CheckoutStep,
  error: string | null,
  t: Translate
): Promise<CheckoutPageView> {
  const address = cart.shipping_address
  const selects = address
    ? await selectsOf(address)
    : { province: "", district: "", neighborhood: "" }
  const complete = addressComplete(cart)
  const chosen = cart.shipping_methods[0] ?? null
  const [provinces, districts, neighborhoods, options, payment] = await Promise.all([
    provinceOptions(),
    selects.province ? districtOptions(selects.province) : [],
    selects.district ? neighborhoodOptions(selects.district) : [],
    complete ? shippingOptions(cart.id) : [],
    complete && chosen
      ? paymentStep(cart, t)
      : { paymentMethods: [], contracts: {}, ageLimit: null },
  ])
  return {
    step,
    address: {
      values: {
        email: cart.email ?? "",
        phone: address?.phone ? displayPhone(address.phone) : "",
        first_name: address?.first_name ?? "",
        last_name: address?.last_name ?? "",
        ...selects,
        address_1: address?.address_1 ?? "",
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
    summary: summaryOf(cart, t),
    error,
    editPaths: STEP_PATHS,
  }
}
