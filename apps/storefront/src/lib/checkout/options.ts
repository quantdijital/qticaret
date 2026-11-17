import "server-only"
import { isStoreApiError } from "../store-api/errors"
import { storeGet } from "../store-api/server"

/**
 * What the backend offers this cart at checkout (D7): shipping options,
 * ways to pay, the contracts to accept and whether an age is asked.
 * Amounts are the backend's; the storefront only shows them.
 */

export interface ShippingOption {
  id: string
  name: string
  price_type: "flat" | "calculated"
  amount: number | null
  calculated_price?: { calculated_amount: number | null } | null
  type?: { label: string | null; description: string | null } | null
}

export async function shippingOptions(cartId: string): Promise<ShippingOption[]> {
  const { shipping_options } = await storeGet<{ shipping_options: ShippingOption[] }>(
    "/store/shipping-options",
    { cart_id: cartId }
  )
  return shipping_options
}

/** An option's price for this cart, in lira; null when the carrier did not price it. */
export const optionPrice = (option: ShippingOption): number | null =>
  option.calculated_price?.calculated_amount ?? option.amount ?? null

export interface PaymentMethods {
  card_providers: string[]
  card_providers_down: string[]
  bank_transfer: {
    provider_id: string
    account_holder: string
    bank_name: string
    iban: string
    deadline_hours: number
  } | null
  cash_on_delivery: { provider_id: string; fee: string } | null
}

/** The ways to pay; with a cart, cash on delivery judged for it. */
export const paymentMethods = (cartId: string | null) =>
  storeGet<PaymentMethods>("/store/payment/methods", cartId ? { cart_id: cartId } : {})

export interface Installments {
  enabled: boolean
  max_count: number
}

/** The most installments a card can split this cart into; 1 when the shop offers none. */
export async function maxInstallments(cartId: string): Promise<number> {
  try {
    const { installments } = await storeGet<{ installments: Installments }>(
      "/store/payment/installments",
      { cart_id: cartId }
    )
    return installments.enabled ? installments.max_count : 1
  } catch (error) {
    // A provider that does not answer leaves out the line, not the page
    if (isStoreApiError(error)) {
      return 1
    }
    throw error
  }
}

export type ContractKind = "pre_information" | "distance_sales"
export const CONTRACT_KINDS: ContractKind[] = ["pre_information", "distance_sales"]

export interface Contract {
  kind: ContractKind
  version: number
  title: string
  html: string
}

/**
 * The order contracts filled for the cart as it stands, as the backend
 * renders them for the way of paying; one the shop has not published is
 * not asked for (the backend asks for nothing then).
 */
export async function contracts(
  cartId: string,
  // `credit`: nothing to pay, the contract names no way of paying
  payment: "card" | "bank_transfer" | "cash_on_delivery" | "credit"
): Promise<Contract[]> {
  const found = await Promise.all(
    CONTRACT_KINDS.map(async (kind) => {
      try {
        const { document } = await storeGet<{ document: Contract }>(
          `/store/carts/${encodeURIComponent(cartId)}/legal/${kind}`,
          payment === "credit" ? {} : { payment }
        )
        return document
      } catch (error) {
        if (isStoreApiError(error) && error.status === 404) {
          return null
        }
        throw error
      }
    })
  )
  return found.filter((each): each is Contract => each !== null)
}

export interface AgeCheck {
  required: boolean
  min_age: number | null
  declared: boolean
}

export async function ageCheck(cartId: string): Promise<AgeCheck> {
  const { age_check } = await storeGet<{ age_check: AgeCheck }>(
    `/store/carts/${encodeURIComponent(cartId)}/age-declaration`
  )
  return age_check
}
