import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { t } from "@/lib/i18n"
import { robotsOnly } from "@/lib/seo/metadata"
import { isStoreApiError } from "@/lib/store-api/errors"
import { storeCall } from "@/lib/store-api/server"
import { orderHref } from "@/lib/views/order"
import { theme } from "@/theme"

export const metadata: Metadata = robotsOnly("noindex,nofollow", t("order.page_title"))

const KINDS = { "on-bilgilendirme": "pre_information", "mesafeli-satis": "distance_sales" } as const
const ORDER_ID = /^order_[0-9A-Za-z]{10,64}$/
const TOKEN = /^[0-9a-z]{1,12}\.[A-Za-z0-9_-]{43}$/

/**
 * `/siparis/:id/belge/:kind` (F13.2): the contract as it was accepted for
 * this order, kept by the backend; signed in or with the order's key.
 */
export default async function OrderDocument({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; kind: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [{ id, kind }, query] = await Promise.all([params, searchParams])
  const token =
    typeof query["token"] === "string" && TOKEN.test(query["token"]) ? query["token"] : null
  if (!ORDER_ID.test(id) || !(kind in KINDS)) {
    notFound()
  }
  let document: { title: string; html: string; created_at: string | null }
  try {
    ;({ document } = await storeCall<{ document: typeof document }>(
      `/store/orders/${encodeURIComponent(id)}/legal/${KINDS[kind as keyof typeof KINDS]}`,
      token ? { headers: { "x-order-token": token } } : {}
    ))
  } catch (error) {
    if (isStoreApiError(error) && error.status === 404) {
      notFound()
    }
    throw error
  }
  return (
    <theme.ContentPage
      t={t}
      view={{
        title: document.title,
        html: document.html,
        publishedAt: document.created_at,
        breadcrumbs: [
          { label: t("order.page_title"), path: orderHref(id, token) },
          { label: document.title, path: null },
        ],
      }}
    />
  )
}
