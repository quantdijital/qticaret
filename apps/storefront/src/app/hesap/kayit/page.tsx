import type { Metadata } from "next"
import { awayIfSignedIn } from "@/lib/account/guard"
import { t } from "@/lib/i18n"
import { robotsOnly } from "@/lib/seo/metadata"
import { authActions } from "@/lib/theme-actions"
import { authView, membershipTerms } from "@/lib/views/account"
import { theme } from "@/theme"

export const metadata: Metadata = robotsOnly("noindex,nofollow", t("account.register_title"))

/** `/hesap/kayit` (D8): a new account; the shop's membership text accepted when it has one. */
export default async function RegisterPage() {
  await awayIfSignedIn()
  const terms = await membershipTerms()
  return <theme.AuthPage t={t} actions={authActions} view={authView("register", { terms })} />
}
