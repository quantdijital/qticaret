import { useQuery } from "@tanstack/react-query"
import { useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import { ErrorState, LoadingRows } from "@qticaret/admin-ui/patterns/states"
import { providerAccountsQuery } from "@/features/settings/api/payments"
import { sectionQuery } from "@/features/settings/api/sections"
import type { PromotionSettings, ShippingSettings } from "@/features/settings/api/sections"
import { shopShippingOptionsQuery } from "@/features/settings/api/shipping-options"
import { ShippingFeeCard } from "@/features/settings/components/shipping-fee-card"
import { ShippingOptionsCard } from "@/features/settings/components/shipping-options-card"
import { detectFee } from "@/features/settings/shipping-fee"
import type { CarrierPricing } from "@/features/settings/shipping-fee"
import { useFirstCarrier } from "@/features/settings/use-first-carrier"
import { errorText } from "@/lib/errors"

/** The fee card's anchor: "Kargo ayarlarında değiştir" on the promotions page opens here. */
export const FREE_SHIPPING_ANCHOR = "free-shipping"

/**
 * Settings > Shipping > Seçenekler ve ücretler, top: the one fee question
 * and, below it, the extra options. Both read the same options, the main
 * option's id (`shipping.primary_option_id`) and the free shipping total.
 */
export function ShippingFeeSection({ saved }: { saved: ShippingSettings }) {
  const { t } = useTranslation()
  const options = useQuery(shopShippingOptionsQuery())
  const promotions = useQuery(sectionQuery<PromotionSettings>("promotions"))
  const first = useFirstCarrier()
  const accounts = useQuery(providerAccountsQuery()).data?.accounts ?? []
  const connected = accounts
    .filter((account) => account.state !== "not_configured")
    .map((account) => account.provider)
  const box = useRef<HTMLDivElement>(null)
  const ready = options.data !== undefined && promotions.data !== undefined
  useEffect(() => {
    if (ready && window.location.hash === `#${FREE_SHIPPING_ANCHOR}`) {
      box.current?.scrollIntoView({ block: "start" })
    }
  }, [ready])
  const failed = options.isError ? options : promotions.isError ? promotions : null
  if (failed) {
    return <ErrorState text={errorText(t, failed.error)} onRetry={() => void failed.refetch()} />
  }
  if (!options.data || !promotions.data) {
    return <LoadingRows rows={3} />
  }
  const threshold = promotions.data.values.free_shipping_threshold
  const condition = promotions.data.values.free_shipping_condition
  const contract =
    first === "aras" ||
    first === "yurtici" ||
    first === "dhlecommerce" ||
    first === "surat" ||
    first === "ptt"
      ? first
      : null
  const firstSource: CarrierPricing = `${contract ?? "aras"}-table`
  const state = detectFee(options.data, saved.primary_option_id, threshold, firstSource, condition)
  const flatCarrier = contract ?? "manual"
  // Remade from what is stored after every save: the answer shows what the server kept
  const key = JSON.stringify([options.data, saved.primary_option_id, threshold, condition])
  return (
    <>
      <div id={FREE_SHIPPING_ANCHOR} ref={box} className="scroll-mt-4">
        <ShippingFeeCard
          key={key}
          state={state}
          tableEmpty={saved.rate_table.length === 0}
          flatCarrier={flatCarrier}
          connected={connected}
        />
      </div>
      <ShippingOptionsCard options={state.extras} custom={state.mode === "custom"} />
    </>
  )
}
