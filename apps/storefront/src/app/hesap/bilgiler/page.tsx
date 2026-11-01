import type { Metadata } from "next"
import { requireCustomer } from "@/lib/account/guard"
import { t } from "@/lib/i18n"
import { robotsOnly } from "@/lib/seo/metadata"
import { accountActions } from "@/lib/theme-actions"
import { accountView, billingOf, marketingOf, privacyRequestsOf } from "@/lib/views/account"
import { theme } from "@/theme"

export const metadata: Metadata = robotsOnly("noindex,nofollow", t("account.details"))

/** `/hesap/bilgiler` (D8): the customer's name, phone and marketing consents. */
const NOTES: Record<string, string> = {
  kvkk: "account.notice_privacy_sent",
  "kvkk-olmadi": "account.notice_privacy_failed",
}

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [customer, query] = await Promise.all([requireCustomer("/hesap/bilgiler"), searchParams])
  const [marketing, billing, privacyRequests] = await Promise.all([
    marketingOf(),
    billingOf(),
    privacyRequestsOf(t),
  ])
  const note = typeof query["durum"] === "string" ? NOTES[query["durum"]] : undefined
  return (
    <theme.AccountPage
      t={t}
      actions={accountActions}
      view={accountView("profile", customer, t, {
        marketing,
        billing,
        privacyRequests,
        notice: note ? t(note) : null,
      })}
    />
  )
}
