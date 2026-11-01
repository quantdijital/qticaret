import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { paymentMethods } from "@/lib/checkout/options"
import { t } from "@/lib/i18n"
import {
  orderContractKinds,
  orderInvoice,
  orderReturns,
  orderShipments,
  orderWithToken,
} from "@/lib/orders/order"
import { robotsOnly } from "@/lib/seo/metadata"
import { isStoreApiError } from "@/lib/store-api/errors"
import { orderView } from "@/lib/views/order"
import { orderActions } from "@/lib/theme-actions"
import { theme } from "@/theme"

// An order is the shopper's own: never indexed, never followed
export const metadata: Metadata = robotsOnly("noindex,nofollow", t("order.page_title"))

/**
 * `/siparis/:id?token=` (D7, adr/0037 §2): an order opened with its key,
 * the one the confirmation e-mail carries and checkout hands over. A wrong
 * or old key is a 404, as an unknown order is.
 */
export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [{ id }, query] = await Promise.all([params, searchParams])
  // Without a key, the signed-in customer's own order (D8)
  const token = typeof query["token"] === "string" ? query["token"] : null
  const order = await orderWithToken(id, token)
  if (!order) {
    notFound()
  }
  // The transfer's account, for an order still waiting for the money
  const methods = await paymentMethods(null).catch((error: unknown) => {
    if (isStoreApiError(error)) {
      return null
    }
    throw error
  })
  const [returns, shipments, invoice, contracts] = await Promise.all([
    orderReturns(order.id, token),
    orderShipments(order.id, token),
    orderInvoice(order.id, token),
    orderContractKinds(order.id, token),
  ])
  const note = typeof query["durum"] === "string" ? query["durum"] : null
  return (
    <theme.OrderPage
      t={t}
      actions={orderActions}
      view={orderView(order, methods, query["yeni"] === "1", t, {
        token,
        contracts,
        returns,
        shipments,
        invoice,
        note,
      })}
    />
  )
}
