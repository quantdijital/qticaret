import type { Metadata } from "next"
import { t } from "@/lib/i18n"
import { robotsOnly } from "@/lib/seo/metadata"
import { authActions } from "@/lib/theme-actions"
import { authView } from "@/lib/views/account"
import { theme } from "@/theme"

export const metadata: Metadata = robotsOnly("noindex,nofollow", t("account.reset_title"))

const TOKEN = /^[\w-]+\.[\w-]+\.[\w-]+$/

/**
 * `/hesap/sifre-yenile?token=&email=` (D8): the reset e-mail's link; the
 * new password goes with the link's key (a quarter of an hour long).
 */
export default async function ResetPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const query = await searchParams
  const token =
    typeof query["token"] === "string" && TOKEN.test(query["token"]) ? query["token"] : null
  const email = typeof query["email"] === "string" ? query["email"].slice(0, 254) : null
  return (
    <theme.AuthPage
      t={t}
      actions={authActions}
      view={authView("reset", {
        token,
        email,
        notice: token ? null : t("account.reset_link_invalid"),
      })}
    />
  )
}
