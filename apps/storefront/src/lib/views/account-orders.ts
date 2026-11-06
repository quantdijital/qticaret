import "server-only"
import { formatLira } from "@qticaret/ui"
import type { AccountOrderView, ImageView, Translate } from "@qticaret/ui"
import { storeGet } from "@/lib/store-api/server"
import { DATE, said, thumbnailOf } from "./account-shared"
import { orderProgress } from "./order-progress"

interface StoreOrderRow {
  id: string
  display_id: number
  created_at: string
  status: string
  payment_status: string
  fulfillment_status?: string
  total: number
  items?: { quantity: number; title?: string | null; thumbnail?: string | null }[]
  payment_collections?: { payment_sessions?: { provider_id: string }[] }[]
}

/** Up to three of the order's lines' photos, in order (the list's small stack). */
function orderImages(order: StoreOrderRow): ImageView[] {
  return (order.items ?? [])
    .flatMap((item) => (item.thumbnail ? [thumbnailOf(item.thumbnail, item.title ?? "")] : []))
    .slice(0, 3)
}

/** The order page's steps from the row's statuses: no parcel dates in a list. */
function rowProgress(order: StoreOrderRow, t: Translate): AccountOrderView["progress"] {
  if (order.fulfillment_status === undefined) {
    return undefined
  }
  const providers = (order.payment_collections ?? []).flatMap((collection) =>
    (collection.payment_sessions ?? []).map((session) => session.provider_id)
  )
  return orderProgress(
    {
      status: order.status,
      payment_status: order.payment_status,
      fulfillment_status: order.fulfillment_status,
      created_at: order.created_at,
    },
    [],
    { cashOnDelivery: providers.includes("pp_cod_cod") },
    t,
    (date) => DATE.format(date)
  )
}
/** The customer's orders, newest first, a page at a time. */
export async function customerOrders(
  offset: number,
  limit: number,
  t: Translate
): Promise<{ orders: AccountOrderView[]; count: number }> {
  const { orders, count } = await storeGet<{ orders: StoreOrderRow[]; count: number }>(
    "/store/orders",
    {
      fields: [
        "id",
        "display_id",
        "created_at",
        "status",
        "+payment_status",
        "+fulfillment_status",
        "total",
        "items.quantity",
        "items.title",
        "items.thumbnail",
        // Only the provider is read (cash on delivery has no payment step)
        "*payment_collections.payment_sessions",
      ].join(","),
      order: "-created_at",
      offset,
      limit,
    }
  )
  return {
    count,
    orders: orders.map((order) => {
      const progress = rowProgress(order, t)
      return {
        displayId: String(order.display_id),
        placedAt: DATE.format(new Date(order.created_at)),
        status: said(t, "order.status_", order.status),
        paymentStatus: said(t, "order.payment_", order.payment_status),
        total: formatLira(order.total),
        itemCount: (order.items ?? []).reduce((sum, item) => sum + item.quantity, 0),
        path: `/siparis/${encodeURIComponent(order.id)}`,
        images: orderImages(order),
        ...(progress === undefined ? {} : { progress }),
      }
    }),
  }
}
