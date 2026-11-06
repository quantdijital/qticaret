import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { currentCustomer, customerAddresses } from "@/lib/account/auth"
import { checkoutEvents } from "@/lib/analytics/payloads"
import { TrackEvents } from "@/lib/analytics/TrackEvents"
import { shopperGiftLines } from "@/lib/cart/gift"
import { checkoutCart } from "@/lib/checkout/cart"
import { t } from "@/lib/i18n"
import { robotsOnly } from "@/lib/seo/metadata"
import { checkoutActions } from "@/lib/theme-actions"
import { billingOf } from "@/lib/views/account"
import { checkoutView, stepOf } from "@/lib/views/checkout"
import { theme } from "@/theme"

// docs/13 §7: checkout pages are noindex,nofollow (backend `system_pages`)
export const metadata: Metadata = robotsOnly("noindex,nofollow", t("checkout.title"))

// The step's own refusals, a code that would not come off the summary, a card form gone stale
const RETURN_ERRORS = new Set([
  "checkout.failed",
  "cart.shipping_changed",
  "legal.version_changed",
  "cart.update_failed",
  "cart.payment_link_locked",
  "payments.cart_changed",
])

/**
 * `/odeme` (D7): address, shipping and payment for the shopper's cart.
 * `?adim=adres|kargo` reopens an earlier step; a step past the first one
 * missing is never shown. An empty or ordered cart goes back to `/sepet`.
 */
export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [cart, query, customer] = await Promise.all([
    checkoutCart(),
    searchParams,
    currentCustomer(),
  ])
  if (!cart || cart.items.length === 0) {
    redirect("/sepet")
  }
  const asked = typeof query["adim"] === "string" ? query["adim"] : undefined
  const failed = typeof query["hata"] === "string" ? query["hata"] : null
  const error = failed && RETURN_ERRORS.has(failed) ? t(failed) : null
  const [[saved], billing, gifts] = await Promise.all([
    customer ? customerAddresses() : Promise.resolve([]),
    customer ? billingOf() : Promise.resolve(null),
    shopperGiftLines(cart.id),
  ])
  // A gift card waits for its recipient, and is never paid with a card or credit (adr/0025 Ek 2026-11-03)
  const unnamed = gifts.some((gift) => gift.recipient === null)
  const view = await checkoutView(
    cart,
    stepOf(cart, asked),
    error ?? (unnamed ? t("gift_card.recipient_required") : null),
    t,
    customer ? { ...customer, address: saved ?? null } : null,
    billing
  )
  // A gift line is never paid with credit. Cash on delivery is the backend's to offer: for a
  // payment link's cart only when the shop allows it (adr/0051), absent from the methods otherwise
  const shown =
    gifts.length > 0
      ? {
          ...view,
          paymentMethods: view.paymentMethods.filter((method) => method.kind !== "credit"),
        }
      : view
  const measured = checkoutEvents(cart)
  return (
    <>
      <TrackEvents
        events={measured.events}
        context={measured.context}
        once={`begin_checkout:${cart.id}`}
      />
      <theme.CheckoutPage view={shown} t={t} actions={checkoutActions} />
    </>
  )
}
