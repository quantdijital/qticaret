/**
 * The card payment's waiting page (D7, adr/0026 Ek 2026-11-06): it looks
 * for the order with growing pauses, about two minutes in all, and never
 * spins for ever. Then it says what it knows: the order (its page), the
 * money being given back, or "paid, your order is on its way by e-mail"
 * with the order lookup.
 */

import type { CheckoutResultPageView, Translate } from "@qticaret/ui"

/** Seconds before each look; their sum is the whole wait (2 minutes). */
export const WAIT_DELAYS = [2, 2, 3, 3, 4, 5, 6, 8, 10, 12, 15, 15, 15, 20] as const

/** What the backend says of the cart's payment (`POST /store/carts/:id/order-access`). */
export type PaymentOutcome =
  { state: "ordered"; id: string; token: string } | { state: "refund" } | { state: "pending" }

/** The pause before the look after `tries` looks; the last one's for any later. */
export function waitDelay(tries: number): number {
  const index = Math.min(Math.max(0, Math.floor(tries)), WAIT_DELAYS.length - 1)
  return WAIT_DELAYS[index] ?? 2
}

/** `?deneme=` as a count of looks so far: digits only, never past the last. */
export function triesOf(value: string | null | undefined): number {
  const tries = Number.parseInt((value ?? "").replace(/\D/g, ""), 10)
  return Number.isFinite(tries) ? Math.min(Math.max(0, tries), WAIT_DELAYS.length) : 0
}

/**
 * Where `/odeme/sonuc` sends the shopper next, the order's page aside:
 * the money given back; waiting done (the provider's review, or two
 * minutes gone); or one more look.
 */
export function nextWaitingPath(
  outcome: Exclude<PaymentOutcome, { state: "ordered" }>,
  tries: number,
  providerStatus: string | null
): string {
  if (outcome.state === "refund" || providerStatus === "refund") {
    return "/odeme/durum?d=iade"
  }
  if (providerStatus === "review" || tries >= WAIT_DELAYS.length) {
    return "/odeme/durum?d=gecikti"
  }
  return `/odeme/durum?d=bekliyor&deneme=${String(tries + 1)}`
}

const STATES = {
  bekliyor: "pending",
  hata: "failed",
  gecikti: "late",
  iade: "refund",
} as const

/**
 * `/odeme/durum`'s page: its state from `?d=` (anything else: late), and
 * for a pending one the next look, after the pause its count calls for.
 * Late: the payment is in, the order comes by e-mail, the order lookup
 * beside it. Refunded: back to the cart, with the shop's contact page.
 */
export function resultViewOf(
  asked: string | null | undefined,
  deneme: string | null | undefined,
  t: Translate
): { view: CheckoutResultPageView; refreshSeconds: number | null } {
  // Own keys only: `?d=toString` is no state
  const state =
    asked && Object.hasOwn(STATES, asked) ? STATES[asked as keyof typeof STATES] : "late"
  if (state === "pending") {
    const tries = Math.max(1, triesOf(deneme))
    const retryPath = `/odeme/sonuc?deneme=${String(tries)}`
    return {
      view: { state, retryPath, backPath: "/" },
      refreshSeconds: waitDelay(tries - 1),
    }
  }
  if (state === "failed") {
    return { view: { state, retryPath: null, backPath: "/odeme" }, refreshSeconds: null }
  }
  if (state === "refund") {
    return {
      view: {
        state,
        retryPath: null,
        backPath: "/sepet",
        backLabel: t("checkout.result_to_cart"),
        help: { path: "/iletisim", label: t("checkout.result_contact") },
      },
      refreshSeconds: null,
    }
  }
  return {
    view: {
      state,
      retryPath: null,
      backPath: "/siparis",
      backLabel: t("checkout.result_lookup"),
      help: { path: "/", label: t("not_found.home") },
    },
    refreshSeconds: null,
  }
}
