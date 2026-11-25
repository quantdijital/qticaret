import { useQuery } from "@tanstack/react-query"
import { aiServicesQuery } from "@/features/ai/api/ai"
import { BOOKING_FLAG } from "@/features/products/api/booking"
import { productCatalogQuery } from "@/features/products/api/product-edit"
import type { PartKey } from "@/features/products/layout/parts"
import { useFeature } from "@/features/settings/api/features"
import { useAddonsShown } from "./use-addons-shown"

/**
 * Whether a part of the product page would draw anything for this
 * product, as its card decides (docs/06 "Ürün sayfası"): dates and the
 * program for a product sold by departure, add-ons while the shop uses
 * them, the FAQ draft for a role that may ask, the parcel for a physical
 * product. The line naming the hidden parts leaves the others out: showing
 * them would bring back nothing. While not known yet, a part counts as drawn.
 */
export function usePartDraws(productId: string): (key: PartKey) => boolean {
  const catalog = useQuery(productCatalogQuery(productId)).data
  const booking = useFeature(BOOKING_FLAG)
  const addons = useAddonsShown(productId)
  const faq = useQuery(aiServicesQuery()).data?.tasks.find((task) => task.id === "product_faq")
  const dated = !catalog || (booking && catalog.booking_mode === "departure")
  const only: Partial<Record<PartKey, boolean>> = {
    departures: dated,
    program: dated,
    addons: addons !== false,
    faq: faq === undefined || faq.allowed,
    shipping: !catalog || catalog.kind === "physical",
  }
  return (key) => only[key] ?? true
}
