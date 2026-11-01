import type { Metadata } from "next"
import { t } from "@/lib/i18n"
import { robotsOnly } from "@/lib/seo/metadata"
import { authActions } from "@/lib/theme-actions"
import { authView } from "@/lib/views/account"
import { theme } from "@/theme"

export const metadata: Metadata = robotsOnly("noindex,nofollow", t("account.forgot_title"))

/** `/hesap/sifre-sifirla` (D8): a reset link by e-mail; the answer never tells whether the address has an account. */
export default async function ForgotPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const query = await searchParams
  return (
    <theme.AuthPage
      t={t}
      actions={authActions}
      view={authView("forgot", {
        notice: query["gonderildi"] === "1" ? t("account.notice_reset_sent") : null,
      })}
    />
  )
}
