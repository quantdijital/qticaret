import { useQuery } from "@tanstack/react-query"
import { aiServicesQuery } from "@/features/ai/api/ai"
import { BOOKING_FLAG } from "@/features/products/api/booking"
import { productCatalogQuery } from "@/features/products/api/product-edit"
import type { PartKey } from "@/features/products/layout/parts"
import { useFeature } from "@/features/settings/api/features"

/**
 * Whether a part of the product page would draw anything for this
 * product, as its card decides (docs/06 "Ürün sayfası"): dates and the
 * program for a product sold by departure,
 * the FAQ draft for a role that may ask, the parcel for a physical
 * product. The line naming the hidden parts leaves the others out: showing
 * them would bring back nothing. While not known yet, a part counts as drawn.
 */
export function usePartDraws(productId: string): (key: PartKey) => boolean {
  const catalog = useQuery(productCatalogQuery(productId)).data
  const booking = useFeature(BOOKING_FLAG)
  const faq = useQuery(aiServicesQuery()).data?.tasks.find((task) => task.id === "product_faq")
  const dated = !catalog || (booking && catalog.booking_mode === "departure")
  const only: Partial<Record<PartKey, boolean>> = {
    departures: dated,
    program: dated,
    faq: faq === undefined || faq.allowed,
    shipping: !catalog || catalog.kind === "physical",
  }
  return (key) => only[key] ?? true
}

/**
 * The parts this kind of product does not use, off by default ("Görünüm"
 * says so and still turns them on): the Stok tab of a product sold by
 * departure, whose places are its departures' (adr/0076), or of a service
 * (nothing on a shelf). Unknown yet, none.
 */
export function usePartUnused(productId: string): (key: PartKey) => boolean {
  const catalog = useQuery(productCatalogQuery(productId)).data
  const booking = useFeature(BOOKING_FLAG)
  const placeless =
    catalog !== undefined &&
    ((booking && catalog.booking_mode === "departure") || catalog.kind === "service")
  return (key) => placeless && key === "stock"
}
