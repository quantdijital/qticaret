import type { Metadata } from "next"
import { t } from "@/lib/i18n"
import { robotsOnly } from "@/lib/seo/metadata"
import { authActions } from "@/lib/theme-actions"
import { authView } from "@/lib/views/account"
import { theme } from "@/theme"

export const metadata: Metadata = robotsOnly("noindex,nofollow", t("account.lookup_title"))

/** `/siparis` (adr/0037 §2): a guest finds an order; its link comes by e-mail. */
export default async function OrderLookup({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const query = await searchParams
  return (
    <theme.AuthPage
      t={t}
      actions={authActions}
      view={authView("lookup", {
        notice: query["gonderildi"] === "1" ? t("account.notice_lookup_sent") : null,
      })}
    />
  )
}
