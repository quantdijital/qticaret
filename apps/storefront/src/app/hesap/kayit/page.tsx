import type { Metadata } from "next"
import { awayIfSignedIn } from "@/lib/account/guard"
import { t } from "@/lib/i18n"
import { robotsOnly } from "@/lib/seo/metadata"
import { authActions } from "@/lib/theme-actions"
import { authView, membershipTerms } from "@/lib/views/account"
import { theme } from "@/theme"

export const metadata: Metadata = robotsOnly("noindex,nofollow", t("account.register_title"))

const INVITE = /^[\w.-]{1,200}$/

/**
 * `/hesap/kayit` (D8): a new account; the shop's membership text accepted
 * when it has one. `?davet=` is a migration invite (F14 G6): its key goes
 * with the form and the old shop's records come over at first sign-in.
 */
export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await awayIfSignedIn()
  const [terms, query] = await Promise.all([membershipTerms(), searchParams])
  const invite =
    typeof query["davet"] === "string" && INVITE.test(query["davet"]) ? query["davet"] : null
  return (
    <theme.AuthPage
      t={t}
      actions={authActions}
      view={authView("register", {
        terms,
        invite,
        notice: invite ? t("account.notice_invited") : null,
      })}
    />
  )
}
