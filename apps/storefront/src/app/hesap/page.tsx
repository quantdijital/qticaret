import type { Metadata } from "next"
import { requireCustomer } from "@/lib/account/guard"
import { t } from "@/lib/i18n"
import { robotsOnly } from "@/lib/seo/metadata"
import { accountActions } from "@/lib/theme-actions"
import { accountView, customerOrders } from "@/lib/views/account"
import { theme } from "@/theme"

export const metadata: Metadata = robotsOnly("noindex,nofollow", t("account.title"))

/** `/hesap` (D8): the signed-in customer's latest orders. */
export default async function AccountHome({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [customer, query] = await Promise.all([requireCustomer("/hesap"), searchParams])
  const { orders } = await customerOrders(0, 3, t)
  return (
    <theme.AccountPage
      t={t}
      actions={accountActions}
      view={accountView("overview", customer, t, {
        orders,
        notice: query["hosgeldin"] === "1" ? t("account.notice_welcome") : null,
      })}
    />
  )
}
