import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { purchaseEvent } from "@/lib/analytics/payloads"
import { TrackEvents } from "@/lib/analytics/TrackEvents"
import { visitorAmounts } from "@/lib/analytics/tags"
import { sessionToken } from "@/lib/account/session"
import { paymentMethods } from "@/lib/checkout/options"
import { t } from "@/lib/i18n"
import {
  orderContractKinds,
  orderInvoice,
  orderReturnable,
  orderReturns,
  orderShipments,
  orderSoldAtRetail,
  orderWithToken,
} from "@/lib/orders/order"
import { robotsOnly } from "@/lib/seo/metadata"
import { isStoreApiError } from "@/lib/store-api/errors"
import { linePicturesOf, productPathsOf } from "@/lib/views/line-paths"
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
  const fresh = query["yeni"] === "1"
  // What may come back is the backend's count, read fresh (no-store) with the page
  const [returns, returnable, shipments, invoice, contracts, session, paths, pictures] =
    await Promise.all([
      orderReturns(order.id, token),
      orderReturnable(order.id, token),
      orderShipments(order.id, token),
      orderInvoice(order.id, token),
      orderContractKinds(order.id, token),
      sessionToken(),
      // Each line's product page; a product gone or hidden since reads as text
      productPathsOf(order.items),
      linePicturesOf(order.items),
    ])
  // The purchase's amounts are the order's to allow too, not the session's alone (ADR-0068
  // slice 5 review L2): a wholesale order opened signed out goes without them
  const [amounts, retail] = fresh
    ? await Promise.all([visitorAmounts(), orderSoldAtRetail(order.id, token)])
    : [true, false]
  const note = typeof query["durum"] === "string" ? query["durum"] : null
  return (
    <>
      {/* Fresh from checkout, once per order in this tab; the backend sends the same order server to server */}
      {fresh && (
        <TrackEvents
          events={[purchaseEvent(order)]}
          once={`purchase:${order.id}`}
          visitorAmounts={amounts}
          amounts={retail}
        />
      )}
      <theme.OrderPage
        t={t}
        actions={orderActions}
        view={orderView(order, methods, fresh, t, {
          token,
          contracts,
          returns,
          returnable,
          shipments,
          invoice,
          note,
          guest: session === null,
          paths,
          pictures,
        })}
      />
    </>
  )
}
