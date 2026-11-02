import type { Metadata } from "next"
import { pendingToken } from "@/lib/account/session"
import { TrackEvents } from "@/lib/analytics/TrackEvents"
import { t } from "@/lib/i18n"
import { robotsOnly } from "@/lib/seo/metadata"
import { authActions } from "@/lib/theme-actions"
import { authView } from "@/lib/views/account"
import { theme } from "@/theme"

export const metadata: Metadata = robotsOnly("noindex,nofollow", t("account.verify_title"))

type Query = Record<string, string | string[] | undefined>

const CODE = /^[\w-]{10,128}$/

/**
 * `/hesap/dogrula` (D8, adr/0037): the code from the e-mail's link
 * (`?code=`), confirmed by the login that asked for it. In the browser
 * that registered, one click; elsewhere the password is asked again.
 */
export default async function VerifyPage({ searchParams }: { searchParams: Promise<Query> }) {
  const [query, pending] = await Promise.all([searchParams, pendingToken()])
  const code = typeof query["code"] === "string" && CODE.test(query["code"]) ? query["code"] : null
  return (
    <>
      {/* Just registered: the sign-up, once in this tab (docs/20) */}
      {query["yeni"] === "1" && (
        <TrackEvents events={[{ name: "sign_up", method: "email" }]} once="sign_up" />
      )}
      <theme.AuthPage
        t={t}
        actions={authActions}
        view={authView("verify", {
          token: code,
          needsPassword: pending === null,
          notice: query["gonderildi"] === "1" ? t("account.notice_code_sent") : null,
        })}
      />
    </>
  )
}
