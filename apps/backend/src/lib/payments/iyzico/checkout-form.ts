import { z } from "@medusajs/framework/zod"
import { kurus } from "../../money"
import type { Kurus } from "../../money"
import type { HostedCheckout } from "../checkout"
import { iyzicoPrice, parseIyzicoPrice, toIyzicoPrice } from "./amounts"

/**
 * iyzico's Checkout Form (docs/entegrasyonlar/iyzico.md, measured in the
 * sandbox 2026-10-27): the request built from our checkout, and the
 * answers read. The items add up to `price` exactly (else `5062`); our
 * basket already carries every discount, so `price` and `paidPrice` are
 * the amount, and each item is what can be given back for that line.
 */

export const INITIALIZE_PATH = "/payment/iyzipos/checkoutform/initialize/auth/ecom"
export const RETRIEVE_PATH = "/payment/iyzipos/checkoutform/auth/ecom/detail"

/** The installment counts a checkout form can offer. */
const INSTALLMENTS = [1, 2, 3, 6, 9, 12]

// The FAQ allows a placeholder, and the sandbox took it: no Turkish ID number is collected
const IDENTITY_PLACEHOLDER = "11111111111"

export interface CheckoutFormInput {
  /** Our session: the conversation and the basket at iyzico. */
  sessionId: string
  amount: Kurus
  currencyCode: string
  checkout: HostedCheckout
  callbackUrl: string
  installments: { enabled: boolean; max: number }
}

const text = (value: string | null | undefined, max: number) => (value ?? "").trim().slice(0, max)

/** "05321234567" or "5321234567" as "+905321234567"; anything else as given. */
export function iyzicoPhone(phone: string): string {
  const digits = phone.replace(/[\s()-]/g, "")
  const local = /^0?(5\d{9})$/.exec(digits)?.[1]
  return local ? `+90${local}` : digits
}

export function checkoutFormRequest(input: CheckoutFormInput): Record<string, unknown> {
  const { buyer, basket } = input.checkout
  const city = text(buyer.province ?? buyer.city, 60)
  const street = [buyer.address_1, buyer.address_2, buyer.city].filter(Boolean).join(", ")
  const address = {
    contactName: text(`${buyer.first_name} ${buyer.last_name}`, 100),
    city,
    country: buyer.country_code.toLowerCase() === "tr" ? "Turkey" : buyer.country_code,
    address: text(street, 400),
    zipCode: text(buyer.postal_code, 10),
  }
  const price = toIyzicoPrice(input.amount)
  return {
    locale: "tr",
    conversationId: input.sessionId,
    price,
    paidPrice: price,
    currency: input.currencyCode.toUpperCase(),
    basketId: input.sessionId,
    paymentGroup: "PRODUCT",
    callbackUrl: input.callbackUrl,
    enabledInstallments: input.installments.enabled
      ? INSTALLMENTS.filter(
          (count) => input.installments.max === 0 || count <= input.installments.max
        )
      : [1],
    buyer: {
      id: input.sessionId,
      name: text(buyer.first_name, 60),
      surname: text(buyer.last_name, 60),
      gsmNumber: iyzicoPhone(buyer.phone),
      email: input.checkout.email,
      identityNumber: IDENTITY_PLACEHOLDER,
      registrationAddress: address.address,
      ip: input.checkout.ip,
      city,
      country: address.country,
      zipCode: address.zipCode,
    },
    shippingAddress: address,
    billingAddress: address,
    basketItems: basket.map((line) => ({
      id: line.id,
      name: text(line.name, 255),
      category1: line.kind === "shipping" ? "Kargo" : "Ürün",
      itemType: "PHYSICAL",
      price: toIyzicoPrice(kurus(line.amount)),
    })),
  }
}

export const initializeAnswer = z.object({
  status: z.literal("success"),
  conversationId: z.string(),
  token: z.string().min(1).max(200),
  paymentPageUrl: z.url({ protocol: /^https?$/ }),
  // Seconds (the sandbox gave 1800)
  tokenExpireTime: z.number().int().positive(),
  signature: z.string().optional(),
})

const price = iyzicoPrice

export const retrieveAnswer = z.object({
  status: z.literal("success"),
  paymentStatus: z.string(),
  paymentId: z.string().optional(),
  conversationId: z.string().optional(),
  basketId: z.string().optional(),
  currency: z.string().optional(),
  price: price.optional(),
  paidPrice: price.optional(),
  token: z.string().optional(),
  fraudStatus: z.number().int().optional(),
  installment: z.number().int().optional(),
  cardFamily: z.string().nullish(),
  cardAssociation: z.string().nullish(),
  lastFourDigits: z.string().nullish(),
  itemTransactions: z
    .array(
      z.object({
        itemId: z.string(),
        paymentTransactionId: z.string(),
        price,
        paidPrice: price,
      })
    )
    .optional(),
  signature: z.string().optional(),
})

/** A form's result as the platform reads it: amounts in kuruş, nothing personal. */
export interface CheckoutFormResult {
  paid: boolean
  paymentId: string | null
  /** 1 approved, 0 under review, -1 refused (iyzico refunds it). */
  fraudStatus: number | null
  /** What the basket asked, and what the card paid (an installment surcharge on top). */
  price: Kurus | null
  paidPrice: Kurus | null
  currency: string | null
  basketId: string | null
  installment: number | null
  cardFamily: string | null
  cardAssociation: string | null
  lastFour: string | null
  /** Per basket line: iyzico's transaction to refund it by (F5 V10). */
  items: { itemId: string; transactionId: string; paid: Kurus }[]
}

export function checkoutFormResult(answer: z.infer<typeof retrieveAnswer>): CheckoutFormResult {
  const paid = answer.paymentStatus === "SUCCESS"
  return {
    paid,
    paymentId: answer.paymentId ?? null,
    fraudStatus: answer.fraudStatus ?? null,
    price: answer.price === undefined ? null : parseIyzicoPrice(answer.price),
    paidPrice: answer.paidPrice === undefined ? null : parseIyzicoPrice(answer.paidPrice),
    currency: answer.currency ?? null,
    basketId: answer.basketId ?? null,
    installment: answer.installment ?? null,
    cardFamily: answer.cardFamily ?? null,
    cardAssociation: answer.cardAssociation ?? null,
    lastFour: answer.lastFourDigits ?? null,
    items: (answer.itemTransactions ?? []).map((item) => ({
      itemId: item.itemId,
      transactionId: item.paymentTransactionId,
      paid: parseIyzicoPrice(item.paidPrice),
    })),
  }
}
