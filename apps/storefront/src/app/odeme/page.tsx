import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { currentCustomer, customerAddresses } from "@/lib/account/auth"
import { checkoutCart } from "@/lib/checkout/cart"
import { t } from "@/lib/i18n"
import { robotsOnly } from "@/lib/seo/metadata"
import { checkoutActions } from "@/lib/theme-actions"
import { checkoutView, stepOf } from "@/lib/views/checkout"
import { theme } from "@/theme"

// docs/13 §7: checkout pages are noindex,nofollow (backend `system_pages`)
export const metadata: Metadata = robotsOnly("noindex,nofollow", t("checkout.title"))

const RETURN_ERRORS = new Set(["checkout.failed", "cart.shipping_changed", "legal.version_changed"])

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
  const [saved] = customer ? await customerAddresses() : []
  const view = await checkoutView(
    cart,
    stepOf(cart, asked),
    error,
    t,
    customer ? { ...customer, address: saved ?? null } : null
  )
  return <theme.CheckoutPage view={view} t={t} actions={checkoutActions} />
}
