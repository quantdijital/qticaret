import type { Metadata } from "next"
import { resultViewOf } from "@/lib/checkout/waiting"
import { t } from "@/lib/i18n"
import { robotsOnly } from "@/lib/seo/metadata"
import { theme } from "@/theme"

export const metadata: Metadata = robotsOnly("noindex,nofollow", t("checkout.title"))

/**
 * `/odeme/durum` (D7): what became of a card payment, in words. Waiting,
 * the page asks `/odeme/sonuc` again without a script (a meta refresh),
 * with growing pauses for about two minutes; then it says the order comes
 * by e-mail and offers the order lookup. Never a spinner for ever
 * (adr/0026 Ek 2026-11-06).
 */
export default async function PaymentStatus({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const query = await searchParams
  const text = (key: string) => (typeof query[key] === "string" ? query[key] : null)
  const { view, refreshSeconds } = resultViewOf(text("d"), text("deneme"), t)
  return (
    <>
      {view.retryPath && refreshSeconds !== null && (
        <meta httpEquiv="refresh" content={`${String(refreshSeconds)};url=${view.retryPath}`} />
      )}
      <theme.CheckoutResultPage t={t} view={view} />
    </>
  )
}
