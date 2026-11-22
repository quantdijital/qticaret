import type { MedusaContainer } from "@medusajs/framework/types"
import { createCartWorkflow } from "@medusajs/medusa/core-flows"
import type { HttpClient } from "./http"
import { settle } from "./http"
import { PAYTR_ADDRESS } from "./paytr"
import type { StockShop } from "./stock"

/** adr/0076 D6 suites' shared setup: a dated tour asking for travelers, an empty cart. */

const DAY = 24 * 60 * 60 * 1000
let made = 0

/** One traveler as the storefront sends it, with an ID number. */
export const traveler = (
  slotId: string,
  documentNo: string,
  extra: Record<string, string> = {}
) => ({
  slot_id: slotId,
  first_name: "Ayşe",
  last_name: "Yılmaz",
  birth_date: "1990-01-15",
  document_no: documentNo,
  ...extra,
})

/** An empty cart of the shop's storefront, its addresses filled. */
export async function emptyCart(container: MedusaContainer, shop: StockShop): Promise<string> {
  const { result } = await createCartWorkflow(container).run({
    input: {
      region_id: shop.regionId,
      sales_channel_id: shop.salesChannelId,
      currency_code: "try",
      email: "ayse.yilmaz@example.com",
      shipping_address: PAYTR_ADDRESS,
      billing_address: PAYTR_ADDRESS,
    },
  })
  return result.id
}

export interface Tour {
  productId: string
  adult: string
  infant: string
  slotId: string
}

/** A published tour asking for travelers at `level`: an adult (1 place), an infant (none). */
export async function publishTour(
  http: HttpClient,
  headers: Record<string, string>,
  shop: StockShop,
  level: string
): Promise<Tour> {
  const staff = (url: string, body: unknown) =>
    settle(http.post<Record<string, unknown>>(url, body, { headers }))
  const { data } = await http.post<{
    product: { id: string; variants: { id: string; title: string }[] }
  }>(
    "/admin/products",
    {
      title: `Efes turu ${String((made += 1))}`,
      status: "draft",
      options: [{ title: "Kişi", values: ["Yetişkin", "Bebek"] }],
      variants: ["Yetişkin", "Bebek"].map((title) => ({
        title,
        options: { Kişi: title },
        prices: [{ currency_code: "try", amount: title === "Bebek" ? 100 : 900 }],
      })),
      sales_channels: [{ id: shop.salesChannelId }],
    },
    { headers }
  )
  const productId = data.product.id
  const variantOf = (title: string) =>
    data.product.variants.find((variant) => variant.title === title)?.id ?? ""
  const adult = variantOf("Yetişkin")
  const infant = variantOf("Bebek")
  await staff(`/admin/products/${productId}/catalog`, {
    kind: "service",
    booking_mode: "departure",
  })
  await staff(`/admin/products/${productId}`, { status: "published" })
  await staff(`/admin/products/${productId}/bookable`, {
    traveler_fields: { level },
    pax_by_variant: { [infant]: { pax: 0, max_age: 2 } },
  })
  const slots = await staff(`/admin/products/${productId}/booking-slots`, {
    slots: [{ starts_at: new Date(Date.now() + 10 * DAY).toISOString(), capacity: 10 }],
  })
  const slotId = ((slots.data["slots"] as { id: string }[] | undefined) ?? [])[0]?.id ?? ""
  return { productId, adult, infant, slotId }
}
