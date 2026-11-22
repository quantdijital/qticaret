import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { t } from "@/lib/i18n"
import { orderVouchers, voucherHtml } from "@/lib/orders/voucher"
import { robotsOnly } from "@/lib/seo/metadata"
import { orderHref } from "@/lib/views/order"
import { theme } from "@/theme"

export const metadata: Metadata = robotsOnly("noindex,nofollow", t("voucher.title"))

const ORDER_ID = /^order_[0-9A-Za-z]{10,64}$/
const TOKEN = /^[0-9a-z]{1,12}\.[A-Za-z0-9_-]{43}$/

/**
 * `/siparis/:id/voucher` (adr/0076 Ek D7b): the order's booking vouchers,
 * printable from the browser, for its shopper signed in or with the
 * order's key; anyone else finds no page. Drawn by the theme's content
 * page (no new theme part): order number, departures, places, check code.
 */
export default async function OrderVoucher({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [{ id }, query] = await Promise.all([params, searchParams])
  const token =
    typeof query["token"] === "string" && TOKEN.test(query["token"]) ? query["token"] : null
  if (!ORDER_ID.test(id)) {
    notFound()
  }
  const vouchers = await orderVouchers(id, token)
  if (!vouchers || vouchers.length === 0) {
    notFound()
  }
  return (
    <theme.ContentPage
      t={t}
      view={{
        title: t("voucher.title"),
        html: voucherHtml(vouchers, t),
        publishedAt: null,
        breadcrumbs: [
          { label: t("order.page_title"), path: orderHref(id, token) },
          { label: t("voucher.title"), path: null },
        ],
      }}
    />
  )
}
