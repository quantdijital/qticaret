import type { Metadata } from "next"
import { awayIfSignedIn } from "@/lib/account/guard"
import { safeNext } from "@/lib/account/errors"
import { t } from "@/lib/i18n"
import { robotsOnly } from "@/lib/seo/metadata"
import { authActions } from "@/lib/theme-actions"
import { authView } from "@/lib/views/account"
import { theme } from "@/theme"

export const metadata: Metadata = robotsOnly("noindex,nofollow", t("account.login_title"))

type Query = Record<string, string | string[] | undefined>

const NOTICES: Record<string, string> = {
  dogrulandi: "account.notice_verified",
  sifre: "account.notice_password_changed",
}

/** `/hesap/giris` (D8): sign in; `?sonra=` the page to come back to. */
export default async function LoginPage({ searchParams }: { searchParams: Promise<Query> }) {
  await awayIfSignedIn()
  const query = await searchParams
  const notice = Object.keys(NOTICES).find((key) => query[key] === "1")
  const next = typeof query["sonra"] === "string" ? safeNext(query["sonra"]) : null
  return (
    <theme.AuthPage
      t={t}
      actions={authActions}
      view={authView("login", { notice: notice ? t(NOTICES[notice] ?? "") : null, next })}
    />
  )
}
