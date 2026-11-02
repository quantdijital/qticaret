import type { Metadata } from "next"
import { saveCookieChoice } from "@/app/actions/cookies"
import { t } from "@/lib/i18n"
import { cookieConsent } from "@/lib/legal/cookies"
import { robotsOnly } from "@/lib/seo/metadata"
import { cookieBannerOf } from "@/lib/views/cookies"
import { legalDocument, legalPath } from "@/lib/views/legal"
import { theme } from "@/theme"

// No one's search result; the policy it links to may be followed (backend `SYSTEM_PAGES`)
export const metadata: Metadata = robotsOnly("noindex,follow", t("cookies.preferences"))

type Query = Record<string, string | string[] | undefined>

/**
 * `/cerez-tercihleri` (D9): where the footer's "cookie preferences" link
 * leads without script. The banner's form, the answer in force ticked;
 * saved, it comes back here saying so.
 */
export default async function CookiePreferences({
  searchParams,
}: {
  searchParams: Promise<Query>
}) {
  const [query, state, policy] = await Promise.all([
    searchParams,
    cookieConsent(),
    legalDocument("cookie_policy"),
  ])
  const policyPath = policy ? legalPath("cookie_policy") : null
  // The answer could not be read: the question as first asked
  const banner = cookieBannerOf(state, policyPath) ?? {
    policyVersion: null,
    policyPath,
    due: true,
    analytics: false,
    marketing: false,
  }
  return (
    <theme.CookiePreferencesPage
      t={t}
      save={saveCookieChoice}
      view={{
        title: t("cookies.preferences"),
        banner,
        notice: query["kaydedildi"] === "1" ? t("cookies.saved") : null,
      }}
    />
  )
}
