"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import type { ActionResult, OptionView, PlaceOrderResult } from "@qticaret/ui"
import { rememberAddress } from "@/lib/account/auth"
import { sessionToken } from "@/lib/account/session"
import { forgetCart } from "@/lib/cart/cookie"
import { districtOptions, neighborhoodOptions } from "@/lib/checkout/address"
import { addressFromForm, addressPayload } from "@/lib/checkout/address-form"
import { checkoutCart } from "@/lib/checkout/cart"
import { paymentMethods } from "@/lib/checkout/options"
import { rememberPaymentFrame } from "@/lib/checkout/payment-cookie"
import { recordTracking } from "@/lib/checkout/tracking"
import { paymentRedirectOrigins, storefrontEnv } from "@/lib/env"
import { acceptTerms, checkoutError, PlaceOrder, pricesChanged } from "@/lib/checkout/place-order"
import {
  challengeOf,
  completeCart,
  CREDIT_CHECKOUT,
  orderAccess,
  orderPath,
  startPayment,
} from "@/lib/checkout/pay"
import { isStoreApiError } from "@/lib/store-api/errors"
import { storePost } from "@/lib/store-api/server"
import { cardProviderOf } from "@/lib/views/checkout"

/** The address step (D7): the shopper's contact and delivery address on the cart. */
export async function saveAddress(_state: ActionResult, form: FormData): Promise<ActionResult> {
  const cart = await checkoutCart()
  if (!cart) {
    redirect("/sepet")
  }
  const parsed = await addressFromForm(form)
  if (!parsed.ok) {
    return { ok: false, error: parsed.error }
  }
  try {
    await storePost(`/store/carts/${cart.id}`, addressPayload(parsed.value))
  } catch (error) {
    return { ok: false, error: checkoutError(error, "checkout.address_invalid") }
  }
  // A signed-in customer's address goes into their book for next time (best effort)
  if (await sessionToken()) {
    const { first_name, last_name, phone, address_1, address_2, city, province, postal_code } =
      parsed.value
    await rememberAddress({
      first_name,
      last_name,
      phone,
      address_1,
      address_2,
      city,
      province,
      postal_code,
      country_code: "tr",
    }).catch(() => undefined)
  }
  revalidatePath("/odeme")
  redirect("/odeme?adim=kargo")
}

const OPTION_ID = z.string().regex(/^so_[0-9A-Za-z]{10,64}$/)

/** The shipping step: one of the options the backend offered this cart. */
export async function chooseShipping(_state: ActionResult, form: FormData): Promise<ActionResult> {
  const cart = await checkoutCart()
  if (!cart) {
    redirect("/sepet")
  }
  const parsed = OPTION_ID.safeParse(form.get("option_id"))
  if (!parsed.success) {
    return { ok: false, error: "checkout.shipping_required" }
  }
  try {
    await storePost(`/store/carts/${cart.id}/shipping-methods`, { option_id: parsed.data })
  } catch (error) {
    return { ok: false, error: checkoutError(error, "checkout.shipping_failed") }
  }
  revalidatePath("/odeme")
  redirect("/odeme")
}

const NO_CHALLENGE = null

/**
 * The payment step: the contracts accepted, the age declared, then the
 * payment started with the way chosen. A card goes to its provider's form
 * (PayTR framed on our page, iyzico's own page); a transfer or cash on
 * delivery becomes the order now. A proof of work the backend asks for
 * goes back to the form, which solves it and posts again (adr/0044).
 */
export async function placeOrder(
  _state: PlaceOrderResult,
  form: FormData
): Promise<PlaceOrderResult> {
  const cart = await checkoutCart()
  if (!cart) {
    redirect("/sepet")
  }
  const parsed = PlaceOrder.safeParse(Object.fromEntries(form))
  if (!parsed.success) {
    return { ok: false, error: "checkout.payment_required", challenge: NO_CHALLENGE }
  }
  const input = { ...parsed.data, contracts: form.getAll("contracts").map(String) }
  let next: string
  try {
    const methods = await paymentMethods(cart.id)
    // Nothing left to pay: only the gift cards' way, and no other
    const offered =
      cart.total === 0
        ? [CREDIT_CHECKOUT]
        : [
            cardProviderOf(methods),
            methods.bank_transfer?.provider_id,
            methods.cash_on_delivery?.provider_id,
          ]
    if (!offered.includes(input.provider_id)) {
      return { ok: false, error: "checkout.payment_required", challenge: NO_CHALLENGE }
    }
    const refused = await acceptTerms(cart.id, input)
    if (refused) {
      return { ok: false, error: refused, challenge: NO_CHALLENGE }
    }
    // The purchase is measured only within the cookie answer (F10.9); a refusal costs the order nothing
    await recordTracking(cart.id).catch(() => undefined)
    const session = await startPayment(cart.id, input.provider_id, input.challenge ?? null)
    next = await nextStep(cart.id, session.provider_id, session.data)
  } catch (error) {
    const challenge = challengeOf(error)
    if (challenge) {
      return { ok: false, error: null, challenge }
    }
    if (pricesChanged(error)) {
      // The page comes back in this answer with the new totals; the shopper pays again, never this action
      revalidatePath("/", "layout")
    }
    return { ok: false, error: checkoutError(error, "checkout.failed"), challenge: NO_CHALLENGE }
  }
  revalidatePath("/", "layout")
  redirect(next)
}

/** Where the shopper goes once the payment started: the order, the card form, or the provider's page. */
async function nextStep(
  cartId: string,
  providerId: string,
  data: Record<string, unknown>
): Promise<string> {
  if (
    data["method"] === "bank_transfer" ||
    data["method"] === "cash_on_delivery" ||
    data["method"] === "credit"
  ) {
    const orderId = await completeCart(cartId)
    const access = orderId ? await orderAccess(cartId) : null
    if (!access) {
      throw new Error("checkout: the order was not opened")
    }
    await forgetCart()
    return orderPath(access.id, access.token, true)
  }
  const formUrl = typeof data["form_url"] === "string" ? data["form_url"] : null
  if (!formUrl) {
    throw new Error("checkout: the provider gave no form")
  }
  if (providerId === "pp_paytr_paytr") {
    if (!(await rememberPaymentFrame(cartId, formUrl))) {
      throw new Error("checkout: the card form's origin is not allowed")
    }
    return "/odeme/kart"
  }
  // Only a provider's own page (iyzico's): the allow-list, never any https address
  const url = URL.parse(formUrl)
  if (!url || !paymentRedirectOrigins(storefrontEnv()).includes(url.origin)) {
    throw new Error("checkout: the provider's page is not allowed")
  }
  return url.href
}

// An action's arguments come from the browser: checked, whatever their type says
const LOOKUP = z.string().max(80)

/** A province's districts for the address form's next select. */
export async function loadDistricts(province: string): Promise<OptionView[]> {
  const parsed = LOOKUP.safeParse(province)
  if (!parsed.success) {
    return []
  }
  try {
    return await districtOptions(parsed.data)
  } catch (error) {
    if (isStoreApiError(error)) {
      return []
    }
    throw error
  }
}

/** A district's neighbourhoods for the address form's last select. */
export async function loadNeighborhoods(district: string): Promise<OptionView[]> {
  const parsed = LOOKUP.safeParse(district)
  if (!parsed.success) {
    return []
  }
  try {
    return await neighborhoodOptions(parsed.data)
  } catch (error) {
    if (isStoreApiError(error)) {
      return []
    }
    throw error
  }
}
