import type { Metadata } from "next"
import { t } from "@/lib/i18n"
import { robotsOnly } from "@/lib/seo/metadata"
import { theme } from "@/theme"

export const metadata: Metadata = robotsOnly("noindex,nofollow", t("checkout.title"))

const STATES = {
  bekliyor: "pending",
  hata: "failed",
  gecikti: "late",
  iade: "refund",
} as const

/**
 * `/odeme/durum` (D7): what became of a card payment, in words. Waiting,
 * the page asks `/odeme/sonuc` again every three seconds without a script
 * (a meta refresh), so it works wherever the shopper's browser stands.
 */
export default async function PaymentStatus({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const query = await searchParams
  const asked = typeof query["d"] === "string" ? query["d"] : ""
  const state = asked in STATES ? STATES[asked as keyof typeof STATES] : "late"
  const tries = typeof query["deneme"] === "string" ? query["deneme"].replace(/\D/g, "") : "0"
  const retryPath = state === "pending" ? `/odeme/sonuc?deneme=${tries || "0"}` : null
  return (
    <>
      {retryPath && <meta httpEquiv="refresh" content={`3;url=${retryPath}`} />}
      <theme.CheckoutResultPage
        t={t}
        view={{ state, retryPath, backPath: state === "failed" ? "/odeme" : "/" }}
      />
    </>
  )
}
