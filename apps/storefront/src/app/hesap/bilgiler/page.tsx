import type { Metadata } from "next"
import { requireCustomer } from "@/lib/account/guard"
import { t } from "@/lib/i18n"
import { robotsOnly } from "@/lib/seo/metadata"
import { accountActions } from "@/lib/theme-actions"
import { accountView, billingOf, marketingOf } from "@/lib/views/account"
import { theme } from "@/theme"

export const metadata: Metadata = robotsOnly("noindex,nofollow", t("account.details"))

/** `/hesap/bilgiler` (D8): the customer's name, phone and marketing consents. */
export default async function ProfilePage() {
  const customer = await requireCustomer("/hesap/bilgiler")
  const [marketing, billing] = await Promise.all([marketingOf(), billingOf()])
  return (
    <theme.AccountPage
      t={t}
      actions={accountActions}
      view={accountView("profile", customer, t, { marketing, billing })}
    />
  )
}
