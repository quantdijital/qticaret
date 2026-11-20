import "server-only"
import type { PaymentFactsView, ShippingFactsView } from "@qticaret/ui"
import { t } from "@/lib/i18n"
import { isStoreApiError } from "@/lib/store-api/errors"
import { liraRegion, listProducts, storefrontSettings } from "@/lib/store-api/requests"
import { storeGet } from "@/lib/store-api/server"
import { shopMarks } from "./card-extras"
import { installmentRates } from "./content-extras"
import { currentShared } from "./layout"

/**
 * The live facts a content page's `payment_facts` and `shipping_facts`
 * sections show (adr/0046 Ek 2026-11-05 içerik sayfaları; adr/0073 Ek
 * 2026-11-19 (2) K2), fetched at each request. A backend that does not
 * answer leaves the facts out; the page still shows its text.
 */

interface InstallmentsAnswer {
  installments: {
    enabled: boolean
    max_count: number
    families: { family: string; options: { count: number; rate: number }[] }[]
  }
}

/**
 * The card families' rates now. The provider prices a table for an
 * amount, so it is asked for the newest product's; only the rates are
 * shown, which do not follow the amount at the card provider the shop
 * uses first (PayTR). None when the shop offers no installments.
 */
async function rates(): Promise<{
  families: PaymentFactsView["installments"]
  max: number | null
}> {
  const none = { families: [], max: null }
  const [{ products }, region] = await Promise.all([
    listProducts({ limit: 1, order: "-created_at" }),
    liraRegion(),
  ])
  const variant = products[0]?.variants?.[0]?.id
  if (!variant) {
    return none
  }
  const { installments } = await storeGet<InstallmentsAnswer>("/store/payment/installments", {
    variant_id: variant,
    region_id: region.id,
  })
  const families = installments.enabled ? installmentRates(installments.families, t) : []
  return families.length > 0 ? { families, max: installments.max_count } : none
}

/** The payment page's facts: the ways to pay the shop offers now, and the card families' rates. */
export async function paymentFacts(): Promise<PaymentFactsView | null> {
  try {
    const [{ marks }, table] = await Promise.all([
      storefrontSettings(),
      rates().catch((error: unknown) => {
        if (isStoreApiError(error)) {
          return { families: [], max: null }
        }
        throw error
      }),
    ])
    const payments = shopMarks(marks?.payments, t)
    return payments.length > 0 || table.families.length > 0
      ? { marks: payments, installments: table.families, maxInstallments: table.max }
      : null
  } catch (error) {
    if (isStoreApiError(error)) {
      return null
    }
    throw error
  }
}

/** The shipping page's facts: the carriers the shop connected and its own promises. */
export async function shippingFacts(): Promise<ShippingFactsView | null> {
  try {
    // The promises are the design's trust badges (adr/0049 Ek 2026-11-06)
    const [{ marks }, shared] = await Promise.all([storefrontSettings(), currentShared()])
    const carriers = shopMarks(marks?.carriers, t)
    const promises = shared.trust_badges
    return carriers.length > 0 || promises.length > 0 ? { carriers, promises } : null
  } catch (error) {
    if (isStoreApiError(error)) {
      return null
    }
    throw error
  }
}
