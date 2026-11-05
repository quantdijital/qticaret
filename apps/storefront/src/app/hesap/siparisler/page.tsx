import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { requireCustomer } from "@/lib/account/guard"
import { t } from "@/lib/i18n"
import { robotsOnly } from "@/lib/seo/metadata"
import { accountActions } from "@/lib/theme-actions"
import { accountView, customerOrders, startingCategories } from "@/lib/views/account"
import { theme } from "@/theme"

export const metadata: Metadata = robotsOnly("noindex,nofollow", t("account.orders"))

const PAGE_SIZE = 10
const pagePath = (page: number) =>
  page > 1 ? `/hesap/siparisler?sayfa=${String(page)}` : "/hesap/siparisler"

/** `/hesap/siparisler` (D8): every order of the customer, ten a page. */
export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [customer, query] = await Promise.all([requireCustomer("/hesap/siparisler"), searchParams])
  const raw = typeof query["sayfa"] === "string" ? query["sayfa"] : "1"
  const page = /^[1-9]\d{0,3}$/.test(raw) ? Number(raw) : 1
  const { orders, count } = await customerOrders((page - 1) * PAGE_SIZE, PAGE_SIZE, t)
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE))
  if (page > pages) {
    notFound()
  }
  const categories = count === 0 ? await startingCategories() : []
  return (
    <theme.AccountPage
      t={t}
      actions={accountActions}
      view={accountView("orders", customer, t, {
        orders,
        categories,
        pagination: {
          page,
          pages,
          previous: page > 1 ? pagePath(page - 1) : null,
          next: page < pages ? pagePath(page + 1) : null,
          pagePath: Object.fromEntries(
            Array.from({ length: Math.min(pages, 50) }, (_, index) => [
              index + 1,
              pagePath(index + 1),
            ])
          ),
        },
      })}
    />
  )
}
