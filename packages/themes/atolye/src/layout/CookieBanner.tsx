import type { CookieBannerView, Translate } from "@qticaret/ui"
import { CookieDialog } from "./CookieDialog"
import { CookieForm } from "./CookieForm"

/**
 * The cookie question at the foot of every page (F13.8, D9): it shows by
 * itself until the visitor answers under the policy now, then waits,
 * closed, for the footer's "Çerez tercihleri" to open it again with the
 * answer in force ticked.
 */
export function CookieBanner({
  banner,
  save,
  t,
}: {
  banner: CookieBannerView
  save: (form: FormData) => Promise<void>
  t: Translate
}) {
  return (
    <CookieDialog open={banner.due} labelledBy="cerez-baslik" closeLabel={t("cookies.close")}>
      <CookieForm banner={banner} save={save} t={t} headingId="cerez-baslik" />
    </CookieDialog>
  )
}
